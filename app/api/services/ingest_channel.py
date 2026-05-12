"""채널 핸들 → 영상 N개 → 가게 추출 → 카카오 보강 → DB upsert.

진행 상황을 yield 하는 제너레이터 형태. SSE 로 스트림.
"""
from __future__ import annotations

from collections.abc import Iterator

from . import kakao_geo, openai_extract, youtube_api
from .supabase_client import exec_with_retry, get_service_client


def _norm(s: str) -> str:
    import re
    return re.sub(r"\s+", "", (s or "").strip())


def _yt_identifiers(url: str) -> set[str]:
    """YouTube URL/handle 에서 식별자 추출 — UC.. 또는 @handle.
    같은 채널의 두 URL 은 적어도 하나의 식별자를 공유."""
    if not url:
        return set()
    out: set[str] = set()
    if "/channel/" in url:
        cid = url.split("/channel/", 1)[1].split("/")[0].split("?")[0]
        if cid:
            out.add(cid)
    if "/@" in url:
        h = url.split("/@", 1)[1].split("/")[0].split("?")[0]
        if h:
            out.add("@" + h)
    if url.startswith("@"):
        out.add(url.split("?")[0])
    return out


def _upsert_channel(meta: youtube_api.ChannelMeta) -> dict:
    """YouTube 식별자(UC.. + @handle) 우선으로 매칭 → 없으면 정규화 이름 매칭 → 없으면 생성.

    매칭된 행은 user 의 표시 이름(name)을 보존하고 wiki_url 은 @handle 형태로 표준화.
    """
    sb = get_service_client()
    rows = exec_with_retry(sb.table("channels").select("*")).data or []

    incoming_ids = {meta.channel_id}
    if meta.handle:
        incoming_ids.add(meta.handle)

    # 1) 기존 행의 wiki_url 에서 식별자 추출하여 같은 채널 찾기
    existing = next(
        (c for c in rows if _yt_identifiers(c.get("wiki_url") or "") & incoming_ids),
        None,
    )
    # 2) 식별자 매칭 실패 시 정규화 이름으로 한 번 더
    if existing is None:
        norm_title = _norm(meta.title)
        existing = next((c for c in rows if _norm(c["name"]) == norm_title), None)

    # 표준 URL — @handle 우선, 없으면 /channel/UC...
    canonical_url = f"https://www.youtube.com/{meta.handle}" if meta.handle else f"https://www.youtube.com/channel/{meta.channel_id}"

    if existing:
        patch: dict = {}
        # 이름 — YouTube 타이틀이 정식 명칭이라 다르면 갱신
        if meta.title and existing.get("name") != meta.title:
            patch["name"] = meta.title
        # wiki_url 이 비어있거나 /channel/UC... 비표준 형태면 @handle 형태로 표준화
        cur_url = existing.get("wiki_url") or ""
        if not cur_url or ("/channel/" in cur_url and meta.handle):
            patch["wiki_url"] = canonical_url
        if not existing.get("thumbnail_url") and meta.thumbnail_url:
            patch["thumbnail_url"] = meta.thumbnail_url
        if existing.get("channel_type") != "youtube":
            patch["channel_type"] = "youtube"
        if patch:
            exec_with_retry(sb.table("channels").update(patch).eq("id", existing["id"]))
        return {**existing, **patch}

    created = exec_with_retry(sb.table("channels").insert({
        "name": meta.title,
        "channel_type": "youtube",
        "wiki_url": canonical_url,
        "thumbnail_url": meta.thumbnail_url,
    }))
    return created.data[0]


def _appearance_exists(channel_id: int, video_id: str) -> bool:
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("appearances").select("id")
          .eq("channel_id", channel_id).eq("youtube_video_id", video_id)
          .limit(1)
    ).data or []
    return bool(rows)


def _upsert_restaurant(*, name: str, address: str, road_address: str | None,
                      lat: float, lng: float,
                      sido: str | None, sigungu: str | None, dong: str | None,
                      cuisine: str | None,
                      kakao_url: str | None, naver_url: str | None,
                      kakao_place_id: str | None,
                      created_by: int) -> dict:
    sb = get_service_client()
    payload = {
        "current_name": name,
        "current_address": road_address or address,
        "cuisine": cuisine,
        "lat": lat,
        "lng": lng,
        "sido": sido,
        "sigungu": sigungu,
        "dong": dong,
        "kakao_map_url": kakao_url,
        "naver_map_url": naver_url,
        "kakao_place_id": kakao_place_id,
        "created_by": created_by,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    res = exec_with_retry(
        sb.table("restaurants").upsert(payload, on_conflict="current_name,current_address")
    )
    return res.data[0]


def _insert_appearance(restaurant_id: int, channel_id: int, video: youtube_api.VideoMeta) -> dict:
    sb = get_service_client()
    res = exec_with_retry(sb.table("appearances").insert({
        "restaurant_id": restaurant_id,
        "channel_id": channel_id,
        "episode_title": video.title,
        "source_url": f"https://www.youtube.com/watch?v={video.video_id}",
        "youtube_video_id": video.video_id,
        "thumbnail_url": video.thumbnail_url,
        "aired_at": (video.published_at or "")[:10] or None,
    }))
    return res.data[0] if res.data else {}


def ingest_channel_stream(handle: str, max_videos: int, user_seq: int) -> Iterator[dict]:
    """제너레이터 — 단계별 진행 상황을 dict 로 yield.

    이벤트 종류:
      - {"stage":"channel", "channel":{...}}
      - {"stage":"videos_fetched", "count":N}
      - {"stage":"video_start", "i":i, "n":N, "video_id":..., "title":...}
      - {"stage":"video_extracted", "i":..., "found":["가게1",...]}
      - {"stage":"restaurant_saved", "video_id":..., "restaurant":{...}}
      - {"stage":"restaurant_skipped", "video_id":..., "name":..., "reason":...}
      - {"stage":"video_done", "i":...}
      - {"stage":"done", "summary":{"videos":N, "saved":M, "skipped":K}}
      - {"stage":"error", "message":...}
    """
    try:
        # 1) 채널 해석 + 식별자 기반 upsert (이미 있는 행이면 매칭)
        ch_meta = youtube_api.resolve_handle(handle)
        ch_row = _upsert_channel(ch_meta)
        yield {"stage": "channel", "channel": {"id": ch_row["id"], "name": ch_row["name"], "youtube_id": ch_meta.channel_id}}

        if not ch_meta.uploads_playlist_id:
            yield {"stage": "error", "message": "uploads playlist 없음"}
            return

        # 2) 영상 목록
        vids = youtube_api.playlist_video_ids(ch_meta.uploads_playlist_id, max_videos)
        videos = youtube_api.videos_detail(vids)
        yield {"stage": "videos_fetched", "count": len(videos)}

        saved = 0
        skipped = 0
        for i, v in enumerate(videos, start=1):
            yield {"stage": "video_start", "i": i, "n": len(videos), "video_id": v.video_id, "title": v.title}

            if _appearance_exists(ch_row["id"], v.video_id):
                yield {"stage": "video_done", "i": i, "skip": "already ingested"}
                skipped += 1
                continue

            # 3) LLM 추출
            try:
                extracted = openai_extract.extract(v.title, v.description)
            except Exception as e:
                yield {"stage": "video_done", "i": i, "skip": f"openai error: {e}"}
                continue

            yield {"stage": "video_extracted", "i": i, "found": [r.name for r in extracted]}

            # 4) 각 가게 → 카카오 보강 + 저장
            for r in extracted:
                query = f"{r.name} {r.address or ''}".strip()
                kp = kakao_geo.search(query, name_hint=r.name, address_hint=r.address)
                if not kp:
                    yield {"stage": "restaurant_skipped", "video_id": v.video_id, "name": r.name, "reason": "kakao 조회 실패"}
                    continue
                rest = _upsert_restaurant(
                    name=kp.name or r.name,
                    address=kp.address,
                    road_address=kp.road_address,
                    lat=kp.lat,
                    lng=kp.lng,
                    sido=kp.sido,
                    sigungu=kp.sigungu,
                    dong=kp.dong,
                    cuisine=kakao_geo.cuisine_from_category(kp.category),
                    kakao_url=kp.kakao_map_url,
                    naver_url=r.naver_url,
                    kakao_place_id=kp.place_id or None,
                    created_by=user_seq,
                )
                _insert_appearance(rest["id"], ch_row["id"], v)
                saved += 1
                yield {"stage": "restaurant_saved", "video_id": v.video_id, "restaurant": {
                    "id": rest["id"], "name": rest["current_name"], "address": rest["current_address"],
                }}

            yield {"stage": "video_done", "i": i}

        yield {"stage": "done", "summary": {"videos": len(videos), "saved": saved, "skipped": skipped}}
    except Exception as e:
        yield {"stage": "error", "message": str(e)}
