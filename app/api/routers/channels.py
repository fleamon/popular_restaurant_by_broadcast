"""채널 조회 + 영상별 점수/트렌딩."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.supabase_client import get_anon_client

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("")
def list_channels(channel_type: str | None = Query(default=None)) -> list[dict]:
    sb = get_anon_client()
    q = sb.table("channels").select("*").order("name")
    if channel_type:
        q = q.eq("channel_type", channel_type)
    return q.execute().data or []


@router.get("/ranking")
def channel_ranking(limit: int = Query(default=20, le=100)) -> list[dict]:
    sb = get_anon_client()
    rows = sb.table("v_channel_score").select("*").order("net_score", desc=True).limit(limit).execute().data or []
    return [{**r, "id": r["channel_id"]} for r in rows]


@router.get("/appearances/ranking")
def appearance_ranking(limit: int = Query(default=20, le=100)) -> list[dict]:
    """영상 좋아요 랭킹 — vote 탭 '영상 랭킹' 용."""
    sb = get_anon_client()
    rows = sb.table("v_appearance_score").select("*").order("net_score", desc=True).limit(limit).execute().data or []
    return [{**r, "id": r["appearance_id"]} for r in rows]


@router.get("/appearances/trending")
def trending_appearances(limit: int = Query(default=20, le=100)) -> list[dict]:
    """인기 급상승 영상 — 최근 7일 좋아요에 가중치 적용."""
    sb = get_anon_client()
    rows = sb.table("v_trending_appearances").select("*").order("trend_score", desc=True).limit(limit).execute().data or []
    return [{**r, "id": r["appearance_id"]} for r in rows]
