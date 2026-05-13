"""채널 조회 + 영상별 점수/트렌딩."""
from __future__ import annotations

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_superadmin
from ..services.supabase_client import exec_with_retry, get_anon_client, get_service_client

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("")
def list_channels(channel_type: str | None = Query(default=None)) -> list[dict]:
    sb = get_anon_client()
    q = sb.table("channels").select("*").order("name")
    if channel_type:
        q = q.eq("channel_type", channel_type)
    return exec_with_retry(q).data or []


@router.get("/ranking")
def channel_ranking(limit: int = Query(default=1000, le=1000)) -> list[dict]:
    sb = get_anon_client()
    rows = exec_with_retry(
        sb.table("v_channel_score").select("*").order("likes", desc=True).limit(limit)
    ).data or []
    return [{**r, "id": r["channel_id"]} for r in rows]


@router.get("/appearances/ranking")
def appearance_ranking(limit: int = Query(default=1000, le=1000)) -> list[dict]:
    """영상 좋아요 랭킹 — vote 탭 '영상 랭킹' 용. 채널명·식당명 enrich."""
    sb = get_anon_client()
    rows = exec_with_retry(
        sb.table("v_appearance_score").select("*").order("likes", desc=True).limit(limit)
    ).data or []
    if not rows:
        return []
    ch_ids = list({r["channel_id"] for r in rows if r.get("channel_id") is not None})
    rest_ids = list({r["restaurant_id"] for r in rows if r.get("restaurant_id") is not None})
    chs = exec_with_retry(sb.table("channels").select("id, name").in_("id", ch_ids)).data or [] if ch_ids else []
    rests = exec_with_retry(sb.table("restaurants").select("id, current_name").in_("id", rest_ids)).data or [] if rest_ids else []
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


# YouTube 채널 페이지의 og:image (= 채널 아바타) 추출용 정규식.
# <meta property="og:image" content="...">  /  <meta content="..." property="og:image">  둘 다 처리.
_OG_IMAGE_RX = re.compile(
    r'<meta[^>]+(?:property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']'
    r'|content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\'])',
    re.IGNORECASE,
)


def _extract_og_image(html: str) -> str | None:
    m = _OG_IMAGE_RX.search(html)
    if not m:
        return None
    return m.group(1) or m.group(2)


@router.post("/{channel_id}/fetch-thumbnail", dependencies=[Depends(require_superadmin)])
def fetch_channel_thumbnail(channel_id: int) -> dict:
    """채널의 wiki_url(YouTube 채널 URL 권장) 페이지에서 og:image 를 읽어 thumbnail_url 에 저장."""
    sb = get_service_client()
    rows = sb.table("channels").select("id, wiki_url").eq("id", channel_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="channel not found")
    url = rows[0].get("wiki_url")
    if not url:
        raise HTTPException(status_code=400, detail="wiki_url 이 비어있습니다 (먼저 YouTube 채널 URL 을 저장하세요)")
    try:
        # YouTube 가 한국어 페이지를 주도록 Accept-Language 지정. UA 가 없으면 간략 페이지 반환되어 og:image 가 빠짐.
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; baekanmatjido/1.0)",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        }
        with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
            resp.raise_for_status()
            img = _extract_og_image(resp.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"fetch failed: {e}") from e
    if not img:
        raise HTTPException(status_code=422, detail="og:image 를 페이지에서 찾지 못했습니다")
    sb.table("channels").update({"thumbnail_url": img}).eq("id", channel_id).execute()
    return {"thumbnail_url": img}
