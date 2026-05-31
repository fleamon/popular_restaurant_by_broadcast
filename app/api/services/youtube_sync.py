"""YouTube 저장 데이터 동기화 — 제목/썸네일 갱신 + 삭제된 영상 정리.

YouTube API Services 약관은 저장한 API 데이터를 주기적으로(최소 30일마다) 갱신하고,
원본 영상이 삭제·비공개되면 저장본도 동기 삭제하도록 요구한다. 이 모듈이 그 동기화를 수행한다.

동작:
  1) appearances 의 youtube_video_id 를 모아 공식 API(videos_detail)로 현재 상태 조회.
  2) 살아있는 영상 → 제목(episode_title)·썸네일(thumbnail_url) 변경 시 갱신.
  3) 응답에 없는 영상(삭제/비공개) → 해당 appearance 삭제.
  4) 영상이 모두 사라져 appearance 가 0개가 된 식당(restaurant) → 고아이므로 삭제.

진행 상황을 dict 로 yield 하는 제너레이터(sync_stream, 수동 실행 SSE용)와
일괄 실행용 run() 을 함께 제공한다. (수동 직접 추가한 appearance 는 youtube_video_id
가 없으므로 동기화 대상에서 제외된다.)
"""
from __future__ import annotations

from collections.abc import Iterator

from . import youtube_api
from .supabase_client import exec_with_retry, fetch_all, get_service_client


def sync_stream() -> Iterator[dict]:
    sb = get_service_client()
    rows = fetch_all(
        sb.table("appearances").select("id, restaurant_id, youtube_video_id, episode_title, thumbnail_url")
    )
    apps = [a for a in rows if a.get("youtube_video_id")]
    yield {"stage": "start", "total": len(apps)}
    if not apps:
        yield {"stage": "done", "summary": {"checked": 0, "updated": 0,
                                            "removed_appearances": 0, "removed_restaurants": 0, "dead_videos": 0}}
        return

    # 한 영상이 여러 식당 appearance 에 쓰일 수 있어 video_id → [appearance...] 매핑.
    by_vid: dict[str, list[dict]] = {}
    for a in apps:
        by_vid.setdefault(a["youtube_video_id"], []).append(a)
    video_ids = list(by_vid.keys())

    try:
        metas = youtube_api.videos_detail(video_ids)
    except Exception as e:
        yield {"stage": "error", "message": f"YouTube API 조회 실패: {e}"}
        return
    alive = {m.video_id: m for m in metas}

    updated = removed_apps = 0

    # 1) 살아있는 영상 — 제목/썸네일 변경분만 갱신
    for vid, meta in alive.items():
        for a in by_vid.get(vid, []):
            patch: dict = {}
            if meta.title and meta.title != a.get("episode_title"):
                patch["episode_title"] = meta.title
            if meta.thumbnail_url and meta.thumbnail_url != a.get("thumbnail_url"):
                patch["thumbnail_url"] = meta.thumbnail_url
            if patch:
                exec_with_retry(sb.table("appearances").update(patch).eq("id", a["id"]))
                updated += 1
                yield {"stage": "updated", "appearance_id": a["id"], "video_id": vid, "fields": list(patch.keys())}

    # 2) 사라진 영상(삭제/비공개) — appearance 삭제
    dead_vids = [v for v in video_ids if v not in alive]
    affected_restaurants: set[int] = set()
    for vid in dead_vids:
        for a in by_vid[vid]:
            affected_restaurants.add(a["restaurant_id"])
            exec_with_retry(sb.table("appearances").delete().eq("id", a["id"]))
            removed_apps += 1
            yield {"stage": "removed", "appearance_id": a["id"], "video_id": vid}

    # 3) 남은 appearance 가 0개인 식당 — 고아이므로 삭제
    removed_rest = 0
    for rid in affected_restaurants:
        cnt = exec_with_retry(
            sb.table("appearances").select("id", count="exact").limit(1).eq("restaurant_id", rid)
        ).count or 0
        if cnt == 0:
            exec_with_retry(sb.table("restaurants").delete().eq("id", rid))
            removed_rest += 1
            yield {"stage": "removed_restaurant", "restaurant_id": rid}

    yield {"stage": "done", "summary": {
        "checked": len(video_ids),
        "updated": updated,
        "removed_appearances": removed_apps,
        "removed_restaurants": removed_rest,
        "dead_videos": len(dead_vids),
    }}


def run() -> dict:
    """비스트리밍 일괄 실행 — cron/CLI 용. 최종 summary 반환, 에러는 RuntimeError."""
    summary: dict = {}
    for ev in sync_stream():
        stage = ev.get("stage")
        if stage == "done":
            summary = ev.get("summary", {})
        elif stage == "error":
            raise RuntimeError(ev["message"])
    return summary
