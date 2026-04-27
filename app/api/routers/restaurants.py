"""맛집 검색/조회 API."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.supabase_client import get_anon_client

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("")
def list_restaurants(
    sido: str | None = Query(default=None),
    sigungu: str | None = Query(default=None),
    dong: str | None = Query(default=None),
    cuisine: str | None = Query(default=None),
    channel_id: int | None = Query(default=None),
    channel_type: str | None = Query(default=None, description="tv/youtube/blog/other"),
    q: str | None = Query(default=None, description="가게명 like 검색"),
    limit: int = Query(default=500, le=1000),
) -> list[dict]:
    sb = get_anon_client()
    query = sb.table("restaurants").select("*").limit(limit)
    if sido:    query = query.eq("sido", sido)
    if sigungu: query = query.eq("sigungu", sigungu)
    if dong:    query = query.eq("dong", dong)
    if cuisine: query = query.eq("cuisine", cuisine)
    if q:       query = query.ilike("current_name", f"%{q}%")
    rows = query.execute().data or []

    # 채널/타입 필터: appearances 를 통해 후처리.
    if channel_id:
        app_rows = sb.table("appearances").select("restaurant_id").eq("channel_id", channel_id).execute().data or []
        allowed = {r["restaurant_id"] for r in app_rows}
        rows = [r for r in rows if r["id"] in allowed]
    elif channel_type:
        ch_rows = sb.table("channels").select("id").eq("channel_type", channel_type).execute().data or []
        if not ch_rows:
            return []
        ch_ids = [c["id"] for c in ch_rows]
        app_rows = sb.table("appearances").select("restaurant_id").in_("channel_id", ch_ids).execute().data or []
        allowed = {r["restaurant_id"] for r in app_rows}
        rows = [r for r in rows if r["id"] in allowed]

    return rows


@router.get("/top")
def top_restaurants(limit: int = Query(default=10, le=50)) -> list[dict]:
    """홈 화면 — 좋아요 최다 맛집 하이라이트."""
    sb = get_anon_client()
    scores = sb.table("v_restaurant_score").select("*").order("net_score", desc=True).limit(limit).execute().data or []
    if not scores:
        return []
    ids = [s["restaurant_id"] for s in scores]
    details = sb.table("restaurants").select("*").in_("id", ids).execute().data or []
    by_id = {d["id"]: d for d in details}
    return [{**by_id[s["restaurant_id"]], **s} for s in scores if s["restaurant_id"] in by_id]


@router.get("/{restaurant_id}")
def get_restaurant(restaurant_id: int) -> dict | None:
    sb = get_anon_client()
    row = sb.table("restaurants").select("*").eq("id", restaurant_id).single().execute()
    return row.data


@router.get("/{restaurant_id}/top-appearance")
def top_appearance(restaurant_id: int) -> dict | None:
    """해당 맛집을 소개한 영상/방송 중 가장 좋아요 많은 1건. 핀 클릭 카드용."""
    sb = get_anon_client()
    top = sb.table("v_top_representative_appearance").select("*").eq("restaurant_id", restaurant_id).execute().data or []
    if not top:
        return None
    appearance_id = top[0]["appearance_id"]
    res = sb.table("appearances").select("*, channels(*)").eq("id", appearance_id).execute().data or []
    return res[0] if res else None
