"""북마크 — 맛집/채널/영상 저장."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_user
from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])

_VALID_TYPES = {"restaurant", "channel", "appearance"}


@router.post("")
def add_bookmark(
    target_type: str = Query(...),
    target_id: int = Query(...),
    user: dict = Depends(require_user),
) -> dict:
    if target_type not in _VALID_TYPES:
        raise HTTPException(status_code=400, detail="invalid target_type")
    sb = get_service_client()
    uid = user["sequence"]
    existing = exec_with_retry(
        sb.table("bookmarks").select("id")
          .eq("user_id", uid)
          .eq("target_type", target_type)
          .eq("target_id", target_id)
          .limit(1)
    ).data or []
    if not existing:
        exec_with_retry(
            sb.table("bookmarks").insert({
                "user_id": uid,
                "target_type": target_type,
                "target_id": target_id,
            })
        )
    return {"ok": True}


@router.delete("")
def remove_bookmark(
    target_type: str = Query(...),
    target_id: int = Query(...),
    user: dict = Depends(require_user),
) -> dict:
    sb = get_service_client()
    exec_with_retry(
        sb.table("bookmarks").delete()
          .eq("user_id", user["sequence"])
          .eq("target_type", target_type)
          .eq("target_id", target_id)
    )
    return {"ok": True}


@router.get("/mine/ids")
def my_bookmark_ids(user: dict = Depends(require_user)) -> dict:
    """북마크 여부 체크용 — { "restaurant:1": true, ... }"""
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("bookmarks").select("target_type, target_id")
          .eq("user_id", user["sequence"])
    ).data or []
    return {f"{r['target_type']}:{r['target_id']}": True for r in rows}


@router.get("/mine")
def my_bookmarks(user: dict = Depends(require_user)) -> dict:
    """내 북마크 상세 목록."""
    sb = get_service_client()
    uid = user["sequence"]
    rows = exec_with_retry(
        sb.table("bookmarks").select("target_type, target_id")
          .eq("user_id", uid)
          .order("created_at", desc=True)
    ).data or []

    restaurant_ids = [r["target_id"] for r in rows if r["target_type"] == "restaurant"]
    channel_ids = [r["target_id"] for r in rows if r["target_type"] == "channel"]
    appearance_ids = [r["target_id"] for r in rows if r["target_type"] == "appearance"]

    restaurants: list[dict] = []
    if restaurant_ids:
        restaurants = exec_with_retry(
            sb.table("restaurants").select("id, current_name, current_address")
              .in_("id", restaurant_ids)
        ).data or []

    channels: list[dict] = []
    if channel_ids:
        channels = exec_with_retry(
            sb.table("channels").select("id, name, thumbnail_url")
              .in_("id", channel_ids)
        ).data or []

    appearances: list[dict] = []
    if appearance_ids:
        raw = exec_with_retry(
            sb.table("appearances")
              .select("id, episode_title, aired_at, restaurants(id, current_name), channels(id, name)")
              .in_("id", appearance_ids)
        ).data or []
        appearances = [
            {
                "id": a["id"],
                "episode_title": a.get("episode_title"),
                "aired_at": a.get("aired_at"),
                "restaurant_id": (a.get("restaurants") or {}).get("id"),
                "restaurant_name": (a.get("restaurants") or {}).get("current_name"),
                "channel_id": (a.get("channels") or {}).get("id"),
                "channel_name": (a.get("channels") or {}).get("name"),
            }
            for a in raw
        ]

    return {
        "restaurants": restaurants,
        "channels": channels,
        "appearances": appearances,
    }
