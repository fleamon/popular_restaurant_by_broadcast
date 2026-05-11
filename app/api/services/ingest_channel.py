"""채널 핸들 → 영상 N개 → 가게 추출 → 카카오 보강 → DB upsert.

진행 상황을 yield 하는 제너레이터 형태. SSE 로 스트림.
"""
from __future__ import annotations

from collections.abc import Iterator

from . import kakao_geo, openai_extract, youtube_api
from .supabase_client import get_service_client


def _norm(s: str) -> str:
    import re
    return re.sub(r"\s+", "", (s or "").strip())


def _upsert_channel(name: str, channel_url: str, thumb: str | None) -> dict:
    """채널을 정규화 이름으로 찾아 갱신/생성."""
    sb = get_service_client()
    rows = sb.table("channels").select("*").execute().data or []
    norm_name = _norm(name)
    existing = next((c for c in rows if _norm(c["name"]) == norm_name), None)
    if existing:
        patch = {}
        if not existing.get("wiki_url"):
            patch["wiki_url"] = channel_url
        if not existing.get("thumbnail_url") and thumb:
            patch["thumbnail_url"] = thumb
        if existing.get("channel_type") != "youtube":
            patch["channel_type"] = "youtube"
        if patch:
            sb.table("channels").update(patch).eq("id", existing["id"]).execute()
        return {**existing, **patch}
    created = sb.table("channels").insert({
        "name": name,
        "channel_type": "youtube",
        "wiki_url": channel_url,
        "thumbnail_url": thumb,
    }).execute()
    return created.data[0]


def _appearance_exists(channel_id: int, video_id: str) -> bool:
    sb = get_service_client()
    rows = sb.table("appearances").select("id") \
        .eq("channel_id", channel_id).eq("youtube_video_id", video_id) \
        .limit(1).execute().data or []
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
    res = sb.table("restaurants").upsert(payload, on_conflict="current_name,current_address").execute()
    return res.data[0]


def _insert_appearance(restaurant_id: int, channel_id: int, video: youtube_api.VideoMeta) -> dict:
    sb = get_service_client()
    res = sb.table("appearances").insert({
        "restaurant_id": restaurant_id,
        "channel_id": channel_id,
        "episode_title": video.title,
        "source_url": f"https://www.youtube.com/watch?v={video.video_id}",
        "youtube_video_id": video.video_id,
        "thumbnail_url": video.thumbnail_url,
        "aired_at": (video.published_at or "")[:10] or None,
    }).execute()
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
        # 1) 채널 해석
        ch_meta = youtube_api.resolve_handle(handle)
        ch_url = f"https://www.youtube.com/channel/{ch_meta.channel_id}"
        ch_row = _upsert_channel(ch_meta.title, ch_url, ch_meta.thumbnail_url)
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
