"""맛집 검색/조회 + 작성/수정 (admin/superadmin)."""
from __future__ import annotations

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_admin
from ..services.supabase_client import exec_with_retry, get_anon_client, get_service_client


def _norm_channel(name: str) -> str:
    """채널명 정규화 — 모든 공백 제거. users.py 의 동일 함수와 일치."""
    return re.sub(r"\s+", "", (name or "").strip())

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
    rows = exec_with_retry(query).data or []

    if channel_id:
        app_rows = exec_with_retry(
            sb.table("appearances").select("restaurant_id").eq("channel_id", channel_id)
        ).data or []
        allowed = {r["restaurant_id"] for r in app_rows}
        rows = [r for r in rows if r["id"] in allowed]
    elif channel_type:
        ch_rows = exec_with_retry(
            sb.table("channels").select("id").eq("channel_type", channel_type)
        ).data or []
        if not ch_rows:
            return []
        ch_ids = [c["id"] for c in ch_rows]
        app_rows = exec_with_retry(
            sb.table("appearances").select("restaurant_id").in_("channel_id", ch_ids)
        ).data or []
        allowed = {r["restaurant_id"] for r in app_rows}
        rows = [r for r in rows if r["id"] in allowed]

    return rows


@router.get("/regions")
def list_regions() -> list[dict]:
    """restaurants 의 distinct (sido, sigungu, dong) 트리플. cascading select 용.

    sido 가 null 인 행은 제외. sigungu/dong 은 null 일 수 있음.
    """
    sb = get_anon_client()
    rows = exec_with_retry(
        sb.table("restaurants").select("sido, sigungu, dong")
    ).data or []
    seen: set[tuple[str | None, str | None, str | None]] = set()
    out: list[dict] = []
    for r in rows:
        if not r.get("sido"):
            continue
        key = (r.get("sido"), r.get("sigungu"), r.get("dong"))
        if key in seen:
            continue
        seen.add(key)
        out.append({"sido": r["sido"], "sigungu": r.get("sigungu"), "dong": r.get("dong")})
    return out


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
    # 입력된 채널명을 모두 정규화 (공백 제거)
    norm_channels = [_norm_channel(c) for c in body.channels if _norm_channel(c)]

    # admin 은 자기 charge_channel 채널만 (정규화 비교)
    if user["role"] == "admin":
        allowed = {_norm_channel(c) for c in (user.get("charge_channel") or [])}
        bad = [c for c in norm_channels if c not in allowed]
        if bad:
            raise HTTPException(status_code=403, detail=f"not in your charge_channel: {bad}")

    payload = body.model_dump(exclude={"channels", "youtube_video_id", "source_url", "episode_title"})
    payload["created_by"] = user["sequence"]
    res = sb.table("restaurants").upsert(payload, on_conflict="current_name,current_address").execute()
    rid = res.data[0]["id"]

    # 모든 채널 한 번에 로드 후 정규화 비교로 매칭 (시드의 공백 포함 이름도 흡수)
    all_channels = sb.table("channels").select("id, name").execute().data or []
    by_norm: dict[str, dict] = {}
    for c in all_channels:
        by_norm.setdefault(_norm_channel(c["name"]), c)

    for norm in norm_channels:
        matched = by_norm.get(norm)
        if matched:
            ch_id = matched["id"]
        else:
            created = sb.table("channels").insert({"name": norm, "channel_type": "other"}).execute()
            ch_id = created.data[0]["id"]
            by_norm[norm] = {"id": ch_id, "name": norm}
        sb.table("appearances").insert({
            "restaurant_id": rid,
            "channel_id": ch_id,
            "episode_title": body.episode_title,
            "source_url": body.source_url,
            "youtube_video_id": body.youtube_video_id,
        }).execute()

    return {"id": rid}


# ─── 좌표 보정 (admin/superadmin) ────────────────────────────────────
class GeoUpdate(BaseModel):
    lat: float
    lng: float
    sido: str | None = None
    sigungu: str | None = None
    dong: str | None = None


@router.patch("/{restaurant_id}/geo")
def update_geo(restaurant_id: int, body: GeoUpdate, user: dict = Depends(require_admin)) -> dict:
    """주소 → 좌표 변환 결과(lat/lng + 시/구/동)를 한 번에 반영. 다른 필드는 건드리지 않음."""
    sb = get_service_client()
    sb.table("restaurants").update(body.model_dump(exclude_none=True)).eq("id", restaurant_id).execute()
    return {"ok": True}


# ─── 네이버 외부 정보 (자세히보기 페이지용) ─────────────────────────
_NAVER_PLACE_RX = re.compile(r"/place/(\d+)")


def _resolve_naver_place_id(url: str) -> str | None:
    """naver.me 단축링크 또는 map.naver.com 링크에서 place_id 추출.

    map.naver.com/p/entry/place/11679997 같이 이미 풀 URL 인 경우 정규식으로 즉시 추출,
    naver.me/xxx 단축링크면 1회 GET 후 redirect Location 헤더에서 추출.
    """
    if not url:
        return None
    m = _NAVER_PLACE_RX.search(url)
    if m:
        return m.group(1)
    try:
        with httpx.Client(timeout=5.0, follow_redirects=False) as client:
            r = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            loc = r.headers.get("location") or ""
            m = _NAVER_PLACE_RX.search(loc)
            if m:
                return m.group(1)
    except Exception:
        pass
    return None


def _fetch_naver_summary(place_id: str) -> dict | None:
    """비공식 네이버 플레이스 summary API. 카테고리/주소/영업시간/이미지/리뷰수 반환."""
    api_url = f"https://map.naver.com/p/api/place/summary/{place_id}"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://map.naver.com/",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            r = client.get(api_url, headers=headers)
            r.raise_for_status()
            return (r.json() or {}).get("data", {}).get("placeDetail")
    except Exception:
        return None


@router.get("/{restaurant_id}/external-info")
def external_info(restaurant_id: int) -> dict:
    """네이버 플레이스에서 카테고리/주소/영업시간/사진/리뷰수 가져오기.

    naver_place_id 가 없으면 naver_map_url 풀어 추출하고 DB 에 캐싱.
    네이버 호출 실패 시에도 200 + naver=null 로 반환(프런트가 우아하게 처리).
    """
    sb = get_service_client()
    rows = sb.table("restaurants").select("id, naver_place_id, naver_map_url").eq("id", restaurant_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="restaurant not found")
    r = rows[0]
    pid = r.get("naver_place_id")
    if not pid and r.get("naver_map_url"):
        pid = _resolve_naver_place_id(r["naver_map_url"])
        if pid:
            sb.table("restaurants").update({"naver_place_id": pid}).eq("id", restaurant_id).execute()
    if not pid:
        return {"naver": None, "place_id": None}
    return {"naver": _fetch_naver_summary(pid), "place_id": pid}
