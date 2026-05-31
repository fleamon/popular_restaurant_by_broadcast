"""채널 조회 + 영상별 점수/트렌딩."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_superadmin
from ..services import youtube_api
from ..services.supabase_client import exec_with_retry, fetch_all, get_anon_client, get_service_client

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("")
def list_channels(channel_type: str | None = Query(default=None)) -> list[dict]:
    sb = get_anon_client()
    q = sb.table("channels").select("*").order("name")
    if channel_type:
        q = q.eq("channel_type", channel_type)
    return exec_with_retry(q).data or []


@router.get("/ranking")
def channel_ranking(
    offset: int = Query(default=0, ge=0, description="페이지 시작 위치"),
    limit: int = Query(default=0, ge=0, le=5000, description="0 = 전체(fetch_all), >0 이면 그만큼만"),
) -> list[dict]:
    """채널 좋아요 랭킹.
    기본 (offset=0, limit=0): 전체 — 데이터 누락 없음.
    페이지 모드 (limit>0): DB 측 정렬·offset·limit.
    """
    sb = get_anon_client()
    builder = (
        sb.table("v_channel_score").select("*")
          .order("likes", desc=True)
          .order("dislikes", desc=False)
          .order("channel_id", desc=True)
    )
    if limit > 0:
        rows = exec_with_retry(builder.range(offset, offset + limit - 1)).data or []
    else:
        rows = fetch_all(builder)
    return [{**r, "id": r["channel_id"]} for r in rows]


@router.get("/appearances/ranking")
def appearance_ranking(
    offset: int = Query(default=0, ge=0, description="페이지 시작 위치 — 페이지 단위 fetch 시"),
    limit: int = Query(default=0, ge=0, le=5000, description="0 = 전체(fetch_all), >0 이면 그만큼만"),
) -> list[dict]:
    """영상 좋아요 랭킹 + 채널/식당 enrich.
    기본 (offset=0, limit=0): 전체 페이지 누적 — 클라가 메모리 정렬·검색·페이지네이션.
    페이지 모드 (limit>0): DB 측 정렬·offset·limit — 운영 데이터 폭증 시 클라가 페이지 단위 호출.
    enrich 의 IN 절 URL 길이 한계 회피를 위해 500 청크 유지.
    """
    sb = get_anon_client()
    builder = (
        sb.table("v_appearance_score").select("*")
          .order("likes", desc=True)
          .order("dislikes", desc=False)
          .order("appearance_id", desc=True)
    )
    if limit > 0:
        # PostgREST 의 range 는 inclusive — [offset, offset+limit-1]
        rows = exec_with_retry(builder.range(offset, offset + limit - 1)).data or []
    else:
        rows = fetch_all(builder)
    if not rows:
        return []

    ch_ids = list({r["channel_id"] for r in rows if r.get("channel_id") is not None})
    rest_ids = list({r["restaurant_id"] for r in rows if r.get("restaurant_id") is not None})

    def _in_chunks(table: str, cols: str, ids: list[int], chunk: int = 500) -> list[dict]:
        out: list[dict] = []
        for i in range(0, len(ids), chunk):
            out.extend(exec_with_retry(sb.table(table).select(cols).in_("id", ids[i:i + chunk])).data or [])
        return out

    chs = _in_chunks("channels", "id, name", ch_ids) if ch_ids else []
    rests = _in_chunks("restaurants", "id, current_name", rest_ids) if rest_ids else []
    ch_map = {c["id"]: c["name"] for c in chs}
    rest_map = {r["id"]: r["current_name"] for r in rests}
    return [
        {
            **r,
            "id": r["appearance_id"],
            "channel_name": ch_map.get(r["channel_id"]),
            "restaurant_name": rest_map.get(r["restaurant_id"]),
        }
        for r in rows
    ]


@router.get("/appearances/trending")
def trending_appearances(limit: int = Query(default=20, le=100)) -> list[dict]:
    """인기 급상승 영상 — 최근 7일 좋아요에 가중치 적용."""
    sb = get_anon_client()
    rows = exec_with_retry(
        sb.table("v_trending_appearances").select("*").order("trend_score", desc=True).limit(limit)
    ).data or []
    return [{**r, "id": r["appearance_id"]} for r in rows]


# ─── 채널 관리 (superadmin) ──────────────────────────────────────────
class ChannelUpdate(BaseModel):
    channel_type: str | None = None
    platform: str | None = None
    wiki_url: str | None = None
    thumbnail_url: str | None = None
    description: str | None = None


@router.patch("/{channel_id}", dependencies=[Depends(require_superadmin)])
def update_channel(channel_id: int, body: ChannelUpdate) -> dict:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="empty update")
    if "channel_type" in payload and payload["channel_type"] not in ("tv", "youtube", "blog", "other"):
        raise HTTPException(status_code=400, detail="invalid channel_type")
    sb = get_service_client()
    sb.table("channels").update(payload).eq("id", channel_id).execute()
    return {"ok": True}


@router.post("/{channel_id}/fetch-thumbnail", dependencies=[Depends(require_superadmin)])
def fetch_channel_thumbnail(channel_id: int) -> dict:
    """채널의 wiki_url(YouTube 채널 URL)을 YouTube Data API 로 풀어 공식 채널 썸네일을 저장.

    과거에는 채널 페이지 HTML 의 og:image 를 스크래핑했으나 YouTube ToS(스크래핑 금지)
    위반이라, 수집 파이프라인과 동일하게 공식 API(youtube_api.resolve_handle)로 대체.
    YouTube 채널이 아닌 wiki_url(TV·블로그 등)에는 동작하지 않는다.
    """
    sb = get_service_client()
    rows = sb.table("channels").select("id, wiki_url").eq("id", channel_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="channel not found")
    url = rows[0].get("wiki_url")
    if not url:
        raise HTTPException(status_code=400, detail="wiki_url 이 비어있습니다 (먼저 YouTube 채널 URL 을 저장하세요)")
    try:
        meta = youtube_api.resolve_handle(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"YouTube API 조회 실패: {e}") from e
    if not meta.thumbnail_url:
        raise HTTPException(status_code=422, detail="채널 썸네일을 찾지 못했습니다")
    sb.table("channels").update({"thumbnail_url": meta.thumbnail_url}).eq("id", channel_id).execute()
    return {"thumbnail_url": meta.thumbnail_url}
