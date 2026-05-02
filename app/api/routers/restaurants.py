"""맛집 검색/조회 + 작성/수정 (admin/superadmin)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_admin
from ..services.supabase_client import get_anon_client, get_service_client

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("")
def list_restaurants(
    sido: str | None = Query(default=None),
    sigungu: str | None = Query(default=None),
    dong: str | None = Query(default=None),
    cuisine: str | None = Query(default=None),
    channel_id: int | None = Query(default=None),
    channel_type: str | None = Query(default=None),
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
    """대표 회차(좋아요 최다) 1건 — 핀 호버 미리보기용. (구버전 호환)"""
    sb = get_anon_client()
    rows = sb.table("v_top2_appearances").select("*").eq("restaurant_id", restaurant_id).eq("rn", 1).execute().data or []
    if not rows:
        return None
    appearance_id = rows[0]["appearance_id"]
    res = sb.table("appearances").select("*, channels(*)").eq("id", appearance_id).execute().data or []
    return res[0] if res else None


@router.get("/{restaurant_id}/top-appearances")
def top2_appearances(restaurant_id: int) -> list[dict]:
    """좋아요 최다 영상 2개 (동률은 최신순) — 지도 핀 클릭 모달용."""
    sb = get_anon_client()
    rows = sb.table("v_top2_appearances").select("*").eq("restaurant_id", restaurant_id).order("rn").execute().data or []
    if not rows:
        return []
    ids = [r["appearance_id"] for r in rows]
    full = sb.table("appearances").select("*, channels(*)").in_("id", ids).execute().data or []
    full_by_id = {r["id"]: r for r in full}
    # rn 순서를 유지하면서 점수 정보까지 합치기
    result = []
    for r in rows:
        f = full_by_id.get(r["appearance_id"])
        if f:
            result.append({**f, "likes": r["likes"], "dislikes": r["dislikes"], "net_score": r["net_score"]})
    return result


# ─── 생성/수정 (admin/superadmin) ────────────────────────────────────
class RestaurantPayload(BaseModel):
    current_name: str
    current_address: str
    cuisine: str | None = None
    sido: str | None = None
    sigungu: str | None = None
    dong: str | None = None
    lat: float | None = None
    lng: float | None = None
    naver_map_url: str | None = None
    kakao_map_url: str | None = None
    naver_place_id: str | None = None
    kakao_place_id: str | None = None
    phone: str | None = None
    notes: str | None = None
    # 등장 채널 (이름 기준) — 같이 받아 appearances 자동 생성
    channels: list[str] = []
    youtube_video_id: str | None = None
    source_url: str | None = None
    episode_title: str | None = None


@router.post("")
def create_restaurant(body: RestaurantPayload, user: dict = Depends(require_admin)) -> dict:
    sb = get_service_client()
    # admin 은 자기가 charge_channel 에 등록된 채널에 대해서만 생성 허용
    allowed = set(user.get("charge_channel") or []) if user["role"] == "admin" else None
    if allowed is not None:
        bad = [c for c in body.channels if c not in allowed]
        if bad:
            raise HTTPException(status_code=403, detail=f"not in your charge_channel: {bad}")

    payload = body.model_dump(exclude={"channels", "youtube_video_id", "source_url", "episode_title"})
    payload["created_by"] = user["sequence"]
    res = sb.table("restaurants").upsert(payload, on_conflict="current_name,current_address").execute()
    rid = res.data[0]["id"]

    # appearances 자동 생성. 채널이 DB 에 없으면 channel_type='other' 로 자동 생성.
    for ch_name in body.channels:
        existing = sb.table("channels").select("id").eq("name", ch_name).execute().data or []
        if existing:
            ch_id = existing[0]["id"]
        else:
            created = sb.table("channels").insert({"name": ch_name, "channel_type": "other"}).execute()
            ch_id = created.data[0]["id"]
        sb.table("appearances").insert({
            "restaurant_id": rid,
            "channel_id": ch_id,
            "episode_title": body.episode_title,
            "source_url": body.source_url,
            "youtube_video_id": body.youtube_video_id,
        }).execute()

    return {"id": rid}
