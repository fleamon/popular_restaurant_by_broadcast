"""맛집 검색/조회 + 작성/수정 (admin/superadmin)."""
from __future__ import annotations

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_admin, require_superadmin
from ..services.supabase_client import exec_with_retry, fetch_all, get_anon_client, get_service_client


def _norm_channel(name: str) -> str:
    """채널명 정규화 — 모든 공백 제거. users.py 의 동일 함수와 일치."""
    return re.sub(r"\s+", "", (name or "").strip())

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


# Postgrest 는 응답 1회당 기본 1000행 한도. appearances 가 그 이상이면 페이지 누적 필요.
def _all_restaurant_ids_for_channels(sb, channel_ids: list[int]) -> set[int]:
    """주어진 채널 ID 들의 모든 appearances 를 페이지 단위로 훑어 distinct restaurant_id 반환."""
    if not channel_ids:
        return set()
    out: set[int] = set()
    start = 0
    PAGE = 1000
    while True:
        chunk = exec_with_retry(
            sb.table("appearances").select("restaurant_id")
              .in_("channel_id", channel_ids).range(start, start + PAGE - 1)
        ).data or []
        out.update(r["restaurant_id"] for r in chunk)
        if len(chunk) < PAGE:
            break
        start += PAGE
    return out


def _resolve_channel_filter(
    sb, *, channel_id: int | None, channel_type: str | None,
) -> set[int] | None:
    """channel_id / channel_type 필터를 restaurant_id 집합으로 환원. 필터 없으면 None."""
    if channel_id:
        return _all_restaurant_ids_for_channels(sb, [channel_id])
    if channel_type:
        ch_rows = exec_with_retry(
            sb.table("channels").select("id").eq("channel_type", channel_type)
        ).data or []
        if not ch_rows:
            return set()
        return _all_restaurant_ids_for_channels(sb, [c["id"] for c in ch_rows])
    return None


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
    page: int = Query(default=0, ge=0, description="1-based 페이지. 0/미지정 시 limit 모드"),
    page_size: int = Query(default=0, ge=0, le=100, description="페이지당 행 수. 0/미지정 시 limit 모드"),
    sort: str = Query(default="id_desc", description="id_desc | likes_desc (likes desc + name asc)"),
    # 지도 viewport bounds — 모두 주어지면 lat/lng 박스 필터 추가
    sw_lat: float | None = Query(default=None),
    sw_lng: float | None = Query(default=None),
    ne_lat: float | None = Query(default=None),
    ne_lng: float | None = Query(default=None),
) -> list[dict]:
    sb = get_anon_client()
    allowed = _resolve_channel_filter(sb, channel_id=channel_id, channel_type=channel_type)
    if allowed is not None and not allowed:
        return []

    def _apply_filters(qb):
        if sido:    qb = qb.eq("sido", sido)
        if sigungu: qb = qb.eq("sigungu", sigungu)
        if dong:    qb = qb.eq("dong", dong)
        if cuisine: qb = qb.eq("cuisine", cuisine)
        if q:       qb = qb.ilike("current_name", f"%{q}%")
        # viewport bounds — sw=남서, ne=북동
        if sw_lat is not None and ne_lat is not None:
            qb = qb.gte("lat", sw_lat).lte("lat", ne_lat)
        if sw_lng is not None and ne_lng is not None:
            qb = qb.gte("lng", sw_lng).lte("lng", ne_lng)
        return qb

    has_bounds = all(v is not None for v in (sw_lat, sw_lng, ne_lat, ne_lng))
    paged = page > 0 and page_size > 0

    # (A) viewport 모드 — bounds 만 주어지고 페이지네이션 없음 → 그 영역 모두 반환 (limit cap 없음)
    if has_bounds and not paged:
        rows = fetch_all(_apply_filters(sb.table("restaurants").select("*")))
        if allowed is not None:
            rows = [r for r in rows if r["id"] in allowed]
        return rows

    # (B) 좋아요 정렬 + 페이지 모드 — likes desc, name asc. score 와 결합 후 메모리 정렬.
    if sort == "likes_desc" and paged:
        # 1) 필터 적용된 모든 (id, name) 받기
        index_rows = fetch_all(_apply_filters(sb.table("restaurants").select("id, current_name")))
        if allowed is not None:
            index_rows = [r for r in index_rows if r["id"] in allowed]
        if not index_rows:
            return []
        # 2) score 매핑 (chunk in_)
        ids = [r["id"] for r in index_rows]
        score_by_id: dict[int, dict] = {}
        CHUNK = 500
        for i in range(0, len(ids), CHUNK):
            sc = exec_with_retry(
                sb.table("v_restaurant_score").select("restaurant_id, likes, dislikes, net_score")
                  .in_("restaurant_id", ids[i:i + CHUNK])
            ).data or []
            for s in sc:
                score_by_id[s["restaurant_id"]] = s
        # 3) 정렬 — likes desc, dislikes asc, name asc, id desc.
        #    같은 좋아요면 싫어요 많을수록 뒤로 → 사용자 요구사항.
        index_rows.sort(key=lambda r: (
            -int(score_by_id.get(r["id"], {}).get("likes", 0) or 0),
            int(score_by_id.get(r["id"], {}).get("dislikes", 0) or 0),
            r.get("current_name") or "",
            -r["id"],
        ))
        # 4) 페이지 슬라이스 → 5) full 데이터 + score 합치기
        start = (page - 1) * page_size
        page_ids = [r["id"] for r in index_rows[start: start + page_size]]
        if not page_ids:
            return []
        full = exec_with_retry(sb.table("restaurants").select("*").in_("id", page_ids)).data or []
        full_by_id = {r["id"]: r for r in full}
        out: list[dict] = []
        for rid in page_ids:  # 정렬 순서 유지
            f = full_by_id.get(rid)
            if not f:
                continue
            s = score_by_id.get(rid, {})
            out.append({
                **f,
                "likes": int(s.get("likes", 0) or 0),
                "dislikes": int(s.get("dislikes", 0) or 0),
                "net_score": int(s.get("net_score", 0) or 0),
            })
        return out

    # (C) 기본 id desc + page — 가장 단순
    query = _apply_filters(sb.table("restaurants").select("*").order("id", desc=True))
    if paged and allowed is None:
        start = (page - 1) * page_size
        rows = exec_with_retry(query.range(start, start + page_size - 1)).data or []
        return rows

    # (D) limit fallback
    query = query.limit(limit)
    rows = exec_with_retry(query).data or []
    if allowed is not None:
        rows = [r for r in rows if r["id"] in allowed]
    return rows


@router.get("/count")
def restaurants_count(
    sido: str | None = Query(default=None),
    sigungu: str | None = Query(default=None),
    dong: str | None = Query(default=None),
    cuisine: str | None = Query(default=None),
    channel_id: int | None = Query(default=None),
    channel_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    """list_restaurants 와 동일 필터 적용 후 총개수만 반환 (limit 무관)."""
    sb = get_anon_client()
    allowed = _resolve_channel_filter(sb, channel_id=channel_id, channel_type=channel_type)
    if allowed is not None and not allowed:
        return {"count": 0}

    def base_q():
        b = sb.table("restaurants").select("id", count="exact").limit(1)
        if sido:    b = b.eq("sido", sido)
        if sigungu: b = b.eq("sigungu", sigungu)
        if dong:    b = b.eq("dong", dong)
        if cuisine: b = b.eq("cuisine", cuisine)
        if q:       b = b.ilike("current_name", f"%{q}%")
        return b

    if allowed is None:
        return {"count": exec_with_retry(base_q()).count or 0}

    # IN 절 URL 길이 한계 회피 — 500개씩 청크로 count 합산.
    # 청크 간 ID 가 서로 겹치지 않게 분할하므로 단순 합산이 정답과 일치.
    total = 0
    CHUNK = 500
    ids_list = list(allowed)
    for i in range(0, len(ids_list), CHUNK):
        res = exec_with_retry(base_q().in_("id", ids_list[i:i + CHUNK]))
        total += res.count or 0
    return {"count": total}


@router.get("/region-center")
def region_center(
    sido: str | None = Query(default=None),
    sigungu: str | None = Query(default=None),
    dong: str | None = Query(default=None),
) -> dict:
    """sido/sigungu/dong 만으로 필터링한 식당들의 평균 좌표.

    채널/카테고리/이름검색 같은 비-지역 필터는 의도적으로 제외 — 지도가 다른 필터에 따라
    움직이지 않도록 '지역 자체' 의 안정된 중심을 제공.
    """
    if not sido:
        return {"lat": None, "lng": None}
    sb = get_anon_client()
    base = sb.table("restaurants").select("lat, lng").eq("sido", sido)
    if sigungu:
        base = base.eq("sigungu", sigungu)
    if dong:
        base = base.eq("dong", dong)

    # Postgrest 1000행 한도 → 페이지네이션 누적
    lat_sum = 0.0
    lng_sum = 0.0
    count = 0
    start = 0
    PAGE = 1000
    while True:
        chunk = exec_with_retry(base.range(start, start + PAGE - 1)).data or []
        for r in chunk:
            if r.get("lat") is not None and r.get("lng") is not None:
                lat_sum += float(r["lat"])
                lng_sum += float(r["lng"])
                count += 1
        if len(chunk) < PAGE:
            break
        start += PAGE

    if count == 0:
        return {"lat": None, "lng": None}
    return {"lat": lat_sum / count, "lng": lng_sum / count}


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
def top_restaurants() -> list[dict]:
    """식당 좋아요 랭킹 — 전체. PostgREST 1000행 한도는 fetch_all 로 페이지 누적, IN 청크."""
    sb = get_anon_client()
    # likes desc → dislikes asc (싫어요 많을수록 뒤로) → restaurant_id desc 안정 키.
    scores = fetch_all(
        sb.table("v_restaurant_score").select("*")
          .order("likes", desc=True)
          .order("dislikes", desc=False)
          .order("restaurant_id", desc=True)
    )
    if not scores:
        return []
    ids = [s["restaurant_id"] for s in scores]
    # IN 절 URL 길이 한계 회피용 청크
    details: list[dict] = []
    CHUNK = 500
    for i in range(0, len(ids), CHUNK):
        details.extend(exec_with_retry(sb.table("restaurants").select("*").in_("id", ids[i:i + CHUNK])).data or [])
    by_id = {d["id"]: d for d in details}
    return [{**by_id[s["restaurant_id"]], **s} for s in scores if s["restaurant_id"] in by_id]


@router.get("/{restaurant_id}")
def get_restaurant(restaurant_id: int) -> dict | None:
    """식당 1건 + likes/dislikes. 자세히보기 페이지 + 핀 모달의 식당 카운터 용."""
    sb = get_anon_client()
    rows = exec_with_retry(sb.table("restaurants").select("*").eq("id", restaurant_id)).data or []
    if not rows:
        return None
    row = rows[0]
    score_rows = exec_with_retry(
        sb.table("v_restaurant_score").select("likes, dislikes, net_score").eq("restaurant_id", restaurant_id)
    ).data or []
    s = score_rows[0] if score_rows else {}
    return {**row, "likes": s.get("likes", 0), "dislikes": s.get("dislikes", 0), "net_score": s.get("net_score", 0)}


class IdsBody(BaseModel):
    ids: list[int]


@router.post("/top-appearances-batch")
def top_appearances_batch(body: IdsBody) -> dict:
    """여러 restaurant_id 에 대한 대표 appearance(rn=1) 를 한 번에 반환. 지도 핀 썸네일용.

    응답: { "<restaurant_id>": <appearance with channels join> }
    """
    if not body.ids:
        return {}
    sb = get_anon_client()
    tops = exec_with_retry(
        sb.table("v_top2_appearances").select("*").in_("restaurant_id", body.ids).eq("rn", 1)
    ).data or []
    if not tops:
        return {}
    app_ids = [t["appearance_id"] for t in tops]
    apps = exec_with_retry(
        sb.table("appearances").select("*, channels(*)").in_("id", app_ids)
    ).data or []
    by_id = {a["id"]: a for a in apps}
    out: dict[str, dict] = {}
    for t in tops:
        a = by_id.get(t["appearance_id"])
        if a:
            out[str(t["restaurant_id"])] = a
    return out


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
    """좋아요 최다 영상 2개 (동률은 최신순) — 지도 핀 클릭 모달용.

    각 행의 channels 객체에 채널 likes/dislikes 도 enrich — 모달 안에서 채널 투표 카운트 표시용.
    """
    sb = get_anon_client()
    rows = exec_with_retry(
        sb.table("v_top2_appearances").select("*").eq("restaurant_id", restaurant_id).order("rn")
    ).data or []
    if not rows:
        return []
    ids = [r["appearance_id"] for r in rows]
    full = exec_with_retry(
        sb.table("appearances").select("*, channels(*)").in_("id", ids)
    ).data or []
    full_by_id = {r["id"]: r for r in full}

    # 채널 score 보강
    ch_ids = list({f["channel_id"] for f in full if f.get("channel_id") is not None})
    ch_scores = exec_with_retry(
        sb.table("v_channel_score").select("channel_id, likes, dislikes").in_("channel_id", ch_ids)
    ).data or [] if ch_ids else []
    ch_score_map = {s["channel_id"]: s for s in ch_scores}

    # rn 순서를 유지하면서 점수 정보까지 합치기
    result = []
    for r in rows:
        f = full_by_id.get(r["appearance_id"])
        if not f:
            continue
        ch = f.get("channels") or {}
        cs = ch_score_map.get(f.get("channel_id"), {})
        f["channels"] = {**ch, "likes": cs.get("likes", 0), "dislikes": cs.get("dislikes", 0)}
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


# ─── 좌표 보정 (superadmin 전용) ─────────────────────────────────────
class GeoUpdate(BaseModel):
    lat: float
    lng: float
    sido: str | None = None
    sigungu: str | None = None
    dong: str | None = None


@router.patch("/{restaurant_id}/geo")
def update_geo(restaurant_id: int, body: GeoUpdate, _: dict = Depends(require_superadmin)) -> dict:
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
