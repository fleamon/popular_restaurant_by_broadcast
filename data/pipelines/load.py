"""Supabase 에 upsert. 사이드이펙트는 여기에 집중."""
from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from ..utils.config import get_config


def _client() -> Client:
    c = get_config()
    if not c["supabase_url"] or not c["supabase_service_role_key"]:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.")
    return create_client(c["supabase_url"], c["supabase_service_role_key"])


def upsert_channel(channel: dict[str, Any]) -> int:
    """채널 이름 기준 upsert. id 반환."""
    row = {
        "name": channel["name"],
        "channel_type": channel.get("channel_type", "other"),
        "platform": channel.get("platform"),
        "wiki_url": channel.get("wiki_url"),
    }
    res = _client().table("channels").upsert(row, on_conflict="name").execute()
    return int(res.data[0]["id"])


def upsert_restaurant(payload: dict[str, Any]) -> int:
    """current_name + current_address 복합 unique 에 맞춰 upsert."""
    res = _client().table("restaurants").upsert(
        payload, on_conflict="current_name,current_address"
    ).execute()
    return int(res.data[0]["id"])


def add_appearance(restaurant_id: int, channel_id: int, **extra: Any) -> None:
    _client().table("appearances").insert({
        "restaurant_id": restaurant_id,
        "channel_id": channel_id,
        **{k: v for k, v in extra.items() if v is not None},
    }).execute()
