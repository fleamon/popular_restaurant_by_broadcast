"""채널 조회 API."""
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
    return sb.table("v_channel_score").select("*").order("net_score", desc=True).limit(limit).execute().data or []
