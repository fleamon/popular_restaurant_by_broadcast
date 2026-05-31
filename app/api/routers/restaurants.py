"""맛집 검색/조회 + 작성/수정 (admin/superadmin)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_admin, require_superadmin
from ..services.supabase_client import exec_with_retry, fetch_all, get_anon_client, get_service_client
from ..utils import norm_channel as _norm_channel

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
    sb, *,
    channel_id: int | None,
    channel_name_like: str | None,
    channel_type: str | None,
) -> set[int] | None:
    """channel_id / channel_name_like / channel_type 를 restaurant_id 집합으로 환원.
    셋 다 비어 있으면 None (= 채널 필터 없음). channel_name_like 와 channel_type 은 AND 결합.
    """
    if channel_id:
        return _all_restaurant_ids_for_channels(sb, [channel_id])
    if channel_name_like or channel_type:
        q = sb.table("channels").select("id")
        if channel_type:       q = q.eq("channel_type", channel_type)
        if channel_name_like:  q = q.ilike("name", f"%{channel_name_like}%")
        ch_rows = exec_with_retry(q).data or []
        if not ch_rows:
            return set()
        return _all_restaurant_ids_for_channels(sb, [c["id"] for c in ch_rows])
    return None


@router.get("")
def list_restaurants(
    sido: str | None = Query(default=None, description="ilike — 부분일치"),
    sigungu: str | None = Query(default=None, description="ilike — 부분일치"),
    dong: str | None = Query(default=None, description="ilike — 부분일치"),
    cuisine: str | None = Query(default=None),
    channel_id: int | None = Query(default=None),
    channel_name_like: str | None = Query(default=None, description="ilike — 채널 이름 부분일치"),
    channel_type: str | None = Query(default=None),
    q: str | None = Query(default=None, description="가게명 like 검색"),
    limit: int = Query(default=500, ge=0, description="0 = 무제한 (fetch_all 페이지 누적)"),
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
    allowed = _resolve_channel_filter(
        sb, channel_id=channel_id, channel_name_like=channel_name_like, channel_type=channel_type,
    )
    if allowed is not None and not allowed:
        return []

    def _apply_filters(qb):
        if sido:    qb = qb.ilike("sido", f"%{sido}%")
        if sigungu: qb = qb.ilike("sigungu", f"%{sigungu}%")
        if dong:    qb = qb.ilike("dong", f"%{dong}%")
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

    # (D) limit fallback — PostgREST 1회 응답 1000행 한도를 우회하려면 fetch_all.
    #     limit=0 또는 1000 초과 요청은 fetch_all 로 누적 후 메모리 slice.
    if limit == 0 or limit > 1000:
        rows = fetch_all(query)
        if allowed is not None:
            rows = [r for r in rows if r["id"] in allowed]
        return rows if limit == 0 else rows[:limit]
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
    channel_name_like: str | None = Query(default=None),
    channel_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    """list_restaurants 와 동일 필터 적용 후 총개수만 반환 (limit 무관)."""
    sb = get_anon_client()
    allowed = _resolve_channel_filter(
        sb, channel_id=channel_id, channel_name_like=channel_name_like, channel_type=channel_type,
    )
    if allowed is not None and not allowed:
        return {"count": 0}

    def base_q():
        b = sb.table("restaurants").select("id", count="exact").limit(1)
        if sido:    b = b.ilike("sido", f"%{sido}%")
        if sigungu: b = b.ilike("sigungu", f"%{sigungu}%")
        if dong:    b = b.ilike("dong", f"%{dong}%")
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
    # like 검색 일관성 — list/count 와 동일하게 ilike 적용.
    base = sb.table("restaurants").select("lat, lng").ilike("sido", f"%{sido}%")
    if sigungu:
        base = base.ilike("sigungu", f"%{sigungu}%")
    if dong:
        base = base.ilike("dong", f"%{dong}%")

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
def top_restaurants(
    offset: int = Query(default=0, ge=0, description="페이지 시작 위치"),
    limit: int = Query(default=0, ge=0, le=5000, description="0 = 전체(fetch_all), >0 이면 그만큼만"),
) -> list[dict]:
    """식당 좋아요 랭킹.
    기본 (offset=0, limit=0): 전체 페이지 누적 — 클라가 메모리 정렬·페이지네이션.
    페이지 모드 (limit>0): DB 측 정렬·offset·limit.
    """
    sb = get_anon_client()
    builder = (
        sb.table("v_restaurant_score").select("*")
          .order("likes", desc=True)
          .order("dislikes", desc=False)
          .order("restaurant_id", desc=True)
    )
    if limit > 0:
        scores = exec_with_retry(builder.range(offset, offset + limit - 1)).data or []
    else:
        scores = fetch_all(builder)
    if not scores:
        return []
    ids = [s["restaurant_id"] for s in scores]
    # IN 절 URL 길이 한계 — 청크.
    CHUNK = 500
    details: list[dict] = []
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


# ─────────────────────────────────────────────────────────────────────
# 영상(appearance) 단위 수정/삭제 — admin 은 본인 charge_channel 영상에 대해 요청,
# superadmin 은 즉시 적용. 한 화면에서 restaurant + appearance 둘 다 다룸.
# ─────────────────────────────────────────────────────────────────────

# 수정 가능한 restaurant 필드 — RestaurantInput 폼이 받는 필드 + 메모/주소 등 부가
_RESTAURANT_EDITABLE = {
    "current_name", "current_address", "cuisine",
    "sido", "sigungu", "dong", "lat", "lng",
    "naver_map_url", "kakao_map_url", "naver_place_id", "kakao_place_id",
    "phone", "notes",
}
# 수정 가능한 appearance 필드 — 등록 시 받는 필드 일체 + channel 변경 허용
_APPEARANCE_EDITABLE = {
    "channel_id", "episode_title", "source_url", "youtube_video_id",
    "thumbnail_url", "summary", "aired_at",
}


def _filter_fields(payload: dict | None, allowed: set[str]) -> dict:
    if not payload:
        return {}
    return {k: v for k, v in payload.items() if k in allowed}


def _can_manage_channel(user: dict, channel_name: str | None) -> bool:
    """superadmin 은 항상 True. admin 은 channel_name 이 본인 charge_channel 에 있을 때."""
    if user.get("role") == "superadmin":
        return True
    if user.get("role") != "admin" or not channel_name:
        return False
    allowed = {_norm_channel(c) for c in (user.get("charge_channel") or [])}
    return _norm_channel(channel_name) in allowed


def _fetch_appearance_full(sb, aid: int) -> dict | None:
    """appearance + restaurant + channel join. 권한 검사·수정 폼에 필요한 모든 필드 포함."""
    rows = exec_with_retry(
        sb.table("appearances")
          .select("*, restaurants(*), channels(id, name, channel_type)")
          .eq("id", aid)
    ).data or []
    return rows[0] if rows else None


@router.get("/appearances/managed")
def list_managed_appearances(
    user: dict = Depends(require_admin),
    channel_id: int | None = Query(default=None, description="지정 시 그 채널 영상만 — superadmin/admin 모두 권한 검증 후"),
) -> list[dict]:
    """수정/삭제 권한이 있는 영상 목록.
      - superadmin: 전체 (또는 channel_id 지정 시 그 채널만)
      - admin: charge_channel 영상만 (channel_id 지정 시 그 ID 가 charge_channel 인지 검증)
    PostgREST 1000행 한도 회피 — fetch_all 로 페이지 누적.
    """
    sb = get_service_client()
    select_cols = (
        "id, restaurant_id, channel_id, episode_title, source_url, youtube_video_id, aired_at, "
        "restaurants(id, current_name, current_address), channels(id, name, channel_type)"
    )

    # admin 권한 검증 — 허용 채널 ID 집합 계산
    allowed_admin_ids: set[int] | None = None
    if user["role"] == "admin":
        allowed_norm = {_norm_channel(c) for c in (user.get("charge_channel") or [])}
        if not allowed_norm:
            return []
        ch_rows = exec_with_retry(sb.table("channels").select("id, name")).data or []
        allowed_admin_ids = {c["id"] for c in ch_rows if _norm_channel(c["name"]) in allowed_norm}
        if not allowed_admin_ids:
            return []

    # 필터 적용 — channel_id 가 명시되면 단일, 아니면 admin 은 charge_channel IN, superadmin 은 무필터
    def _build_query():
        q = sb.table("appearances").select(select_cols).order("id", desc=True)
        if channel_id is not None:
            if allowed_admin_ids is not None and channel_id not in allowed_admin_ids:
                # admin 이 권한 없는 채널 요청 — 강제 빈 결과
                return None
            return q.eq("channel_id", channel_id)
        if allowed_admin_ids is not None:
            return q.in_("channel_id", list(allowed_admin_ids))
        return q

    qb = _build_query()
    if qb is None:
        return []
    rows = fetch_all(qb)
    out = []
    for r in rows:
        rest = r.get("restaurants") or {}
        ch = r.get("channels") or {}
        out.append({
            "id": r["id"],
            "restaurant_id": r.get("restaurant_id"),
            "channel_id": r.get("channel_id"),
            "restaurant_name": rest.get("current_name"),
            "restaurant_address": rest.get("current_address"),
            "channel_name": ch.get("name"),
            "channel_type": ch.get("channel_type"),
            "episode_title": r.get("episode_title"),
            "source_url": r.get("source_url"),
            "youtube_video_id": r.get("youtube_video_id"),
            "aired_at": r.get("aired_at"),
        })
    return out


@router.get("/appearances/{aid}")
def get_appearance_detail(aid: int, user: dict = Depends(require_admin)) -> dict:
    """영상 수정 폼용 — restaurant + appearance + channel 풀어서 반환. 권한 가드 포함."""
    sb = get_service_client()
    row = _fetch_appearance_full(sb, aid)
    if not row:
        raise HTTPException(status_code=404, detail="appearance not found")
    ch_name = (row.get("channels") or {}).get("name")
    if not _can_manage_channel(user, ch_name):
        raise HTTPException(status_code=403, detail="not your charge_channel")
    return row


class AppearanceEditBody(BaseModel):
    restaurant: dict | None = None  # _RESTAURANT_EDITABLE 만 적용
    appearance: dict | None = None  # _APPEARANCE_EDITABLE 만 적용


@router.patch("/appearances/{aid}")
def update_appearance_now(
    aid: int, body: AppearanceEditBody, _: dict = Depends(require_superadmin),
) -> dict:
    """superadmin 즉시 적용 — restaurant + appearance 동시 update."""
    sb = get_service_client()
    row = _fetch_appearance_full(sb, aid)
    if not row:
        raise HTTPException(status_code=404, detail="appearance not found")
    rest_patch = _filter_fields(body.restaurant, _RESTAURANT_EDITABLE)
    app_patch  = _filter_fields(body.appearance, _APPEARANCE_EDITABLE)
    if rest_patch and row.get("restaurant_id"):
        exec_with_retry(sb.table("restaurants").update(rest_patch).eq("id", row["restaurant_id"]))
    if app_patch:
        exec_with_retry(sb.table("appearances").update(app_patch).eq("id", aid))
    return {"ok": True}


@router.delete("/appearances/{aid}")
def delete_appearance_now(aid: int, _: dict = Depends(require_superadmin)) -> dict:
    """superadmin 즉시 영상 삭제. 맛집은 다른 영상이 가리킬 수 있으니 cascade 안 함."""
    sb = get_service_client()
    exec_with_retry(sb.table("appearances").delete().eq("id", aid))
    return {"ok": True}


class EditRequestBody(BaseModel):
    title: str | None = None
    restaurant: dict | None = None
    appearance: dict | None = None


@router.post("/appearances/{aid}/edit-request")
def create_appearance_edit_request(
    aid: int, body: EditRequestBody, user: dict = Depends(require_admin),
) -> dict:
    """admin → superadmin 에게 수정 승인 요청. 변경 페이로드를 requests.payload 에 저장."""
    sb = get_service_client()
    row = _fetch_appearance_full(sb, aid)
    if not row:
        raise HTTPException(status_code=404, detail="appearance not found")
    ch_name = (row.get("channels") or {}).get("name")
    if not _can_manage_channel(user, ch_name):
        raise HTTPException(status_code=403, detail="not your charge_channel")

    rest_after = _filter_fields(body.restaurant, _RESTAURANT_EDITABLE)
    app_after  = _filter_fields(body.appearance, _APPEARANCE_EDITABLE)
    if not rest_after and not app_after:
        raise HTTPException(status_code=400, detail="변경된 값이 없습니다.")

    # 이전 값 스냅샷 — 승인 UI 가 'before / after' 를 나란히 보여주기 위함.
    # 요청 후 다른 admin 이 또 수정해도 요청자가 본 시점의 이전 값이 보존됨.
    rest_row = row.get("restaurants") or {}
    rest_before = {k: rest_row.get(k) for k in rest_after.keys()}
    app_before  = {k: row.get(k)      for k in app_after.keys()}

    rest_name = rest_row.get("current_name") or "(맛집)"
    title = (body.title or f"맛집/영상 수정 요청: {rest_name}").strip()[:100]

    res = exec_with_retry(sb.table("requests").insert({
        "author_id":     user["sequence"],
        "type":          "restaurant_edit",
        "title":         title,
        "restaurant_id": row.get("restaurant_id"),
        "appearance_id": aid,
        "payload": {
            "restaurant_before": rest_before,
            "restaurant_after":  rest_after,
            "appearance_before": app_before,
            "appearance_after":  app_after,
        },
    }))
    return {"id": (res.data[0] if res.data else {}).get("id")}


class DeleteRequestBody(BaseModel):
    reason: str | None = None


@router.post("/appearances/{aid}/delete-request")
def create_appearance_delete_request(
    aid: int, body: DeleteRequestBody, user: dict = Depends(require_admin),
) -> dict:
    """admin → superadmin 에게 영상 삭제 승인 요청."""
    sb = get_service_client()
    row = _fetch_appearance_full(sb, aid)
    if not row:
        raise HTTPException(status_code=404, detail="appearance not found")
    ch_name = (row.get("channels") or {}).get("name")
    if not _can_manage_channel(user, ch_name):
        raise HTTPException(status_code=403, detail="not your charge_channel")

    rest_name = (row.get("restaurants") or {}).get("current_name") or "(맛집)"
    title = f"맛집/영상 삭제 요청: {rest_name}"[:100]
    payload = {"reason": (body.reason or "").strip()[:500]} if body.reason else {}

    res = exec_with_retry(sb.table("requests").insert({
        "author_id":     user["sequence"],
        "type":          "restaurant_delete",
        "title":         title,
        "restaurant_id": row.get("restaurant_id"),
        "appearance_id": aid,
        "payload":       payload,
    }))
    return {"id": (res.data[0] if res.data else {}).get("id")}


# 네이버 플레이스 summary 스크래핑 엔드포인트(/external-info)는 제거됨.
# 비공식 API·SSR 크롤링으로 리뷰/사진을 재현하던 부분이라 법적 리스크가 커서 삭제.
# 식당 상세 페이지는 우리 DB 정보(주소·전화·메모·cuisine)만 표시하고,
# 네이버/카카오는 '지도에서 보기' 링크아웃(restaurants.naver_place_id / naver_map_url)으로만 연결한다.
