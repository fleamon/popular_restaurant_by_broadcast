"""방문자 통계 — 좌측 하단 위젯 (오늘 / 총 unique 방문자) + 일별 추이."""
from __future__ import annotations

from collections import Counter
from datetime import date as date_type, datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/visits", tags=["visits"])

_KST = timezone(timedelta(hours=9))


def _today_kst_iso() -> str:
    return datetime.now(_KST).date().isoformat()


# 흔한 유입 소스 매핑 — 호스트에 부분일치하면 라벨로 묶음.
_REFERER_SOURCES = (
    ("google", "Google"), ("naver", "네이버"), ("youtube", "YouTube"), ("youtu.be", "YouTube"),
    ("instagram", "Instagram"), ("facebook", "Facebook"), ("kakao", "카카오"), ("daum", "다음"),
    ("bing", "Bing"), ("t.co", "X(트위터)"), ("twitter", "X(트위터)"), ("threads", "Threads"),
)


def _norm_referer(raw: str | None) -> str:
    """유입 출처 → 집계용 라벨. 입력은 호스트만(프런트가 추출) 또는 전체 URL 둘 다 허용.
    개인정보 최소화 — 경로/쿼리는 저장하지 않고 호스트 기준 라벨만 보관.
    """
    if not raw:
        return "직접"
    raw = raw.strip()
    try:
        # 전체 URL 이면 hostname 추출, scheme 없는 bare host 면 "//" 를 붙여 파싱.
        host = (urlparse(raw).hostname or urlparse("//" + raw).hostname or "").lower()
    except Exception:
        host = ""
    if not host:
        return "직접"
    # 우리 도메인 내부 이동
    if host.endswith("xn--0z2byb.com") or "vercel.app" in host or host in ("localhost", "127.0.0.1"):
        return "사이트 내"
    for key, label in _REFERER_SOURCES:
        if key in host:
            return label
    # 그 외 — www./m. 접두 제거한 호스트
    return host.removeprefix("www.").removeprefix("m.")


class TrackBody(BaseModel):
    visitor_id: str = Field(min_length=4, max_length=64)
    referer: str | None = Field(default=None, max_length=2048)


@router.post("/track")
def track_visit(body: TrackBody) -> dict:
    """visitor_id 의 오늘(KST) 방문 1건 기록 (유입 출처 라벨 포함).
    (visitor_id, visit_date) UNIQUE 인덱스라 같은 device 가 하루에 여러 번 와도 1회만 —
    그 날 첫 방문의 referer 가 보존된다.
    """
    sb = get_service_client()
    try:
        # ON CONFLICT 회피 — upsert 로 충돌 무시. visit_date 는 generated 라 insert payload 에 없음.
        sb.table("visits").upsert(
            {"visitor_id": body.visitor_id, "referer": _norm_referer(body.referer)},
            on_conflict="visitor_id,visit_date",
            ignore_duplicates=True,
        ).execute()
    except Exception as e:
        # 이미 오늘 표가 있어도 통계 호출에는 영향 없음 — 200 으로 그냥 진행.
        raise HTTPException(status_code=400, detail=f"track failed: {e}")
    return {"ok": True}


@router.get("/stats")
def get_stats() -> dict:
    """오늘 / 총 unique 방문자 수.
    - today: 오늘 visit_date 의 행 수 (visitor_id 단위 unique 는 unique 인덱스로 보장됨)
    - total: 누적 unique visitor_id 수 — distinct count
    """
    sb = get_service_client()
    today = _today_kst_iso()

    # 오늘 카운트
    today_res = exec_with_retry(
        sb.table("visits").select("id", count="exact").limit(1).eq("visit_date", today)
    )
    today_count = today_res.count or 0

    # 총 unique visitor 카운트 — DB 측 count(distinct) RPC (0012_visitors_count_rpc.sql).
    # 과거엔 전체 visitor_id 를 앱 메모리 set 으로 받아 distinct → 데이터 폭증 시 OOM 위험이라 RPC 로 이전.
    try:
        res = exec_with_retry(sb.rpc("count_distinct_visitors"))
        total = int(res.data) if res.data is not None else 0
    except Exception:
        total = 0

    return {"today": today_count, "total": total}


@router.get("/first-date")
def get_first_date() -> dict:
    """DB 에 기록된 최초 방문 날짜."""
    sb = get_service_client()
    res = exec_with_retry(
        sb.table("visits").select("visit_date").order("visit_date").limit(1)
    )
    first = res.data[0]["visit_date"] if res.data else _today_kst_iso()
    return {"first_date": first}


@router.get("/daily")
def get_daily(
    days: int = 30,
    start: str | None = Query(default=None, description="시작일 YYYY-MM-DD"),
    end:   str | None = Query(default=None, description="종료일 YYYY-MM-DD"),
) -> list[dict]:
    """일별 unique 방문자 수 (KST 기준).
    start/end 가 모두 주어지면 해당 범위, 아니면 오늘 기준 최근 days 일.
    """
    sb = get_service_client()
    today = date_type.fromisoformat(_today_kst_iso())

    if start and end:
        from_date = date_type.fromisoformat(start)
        to_date   = date_type.fromisoformat(end)
    else:
        from_date = today - timedelta(days=days - 1)
        to_date   = today

    total_days = (to_date - from_date).days + 1

    all_rows: list[dict] = []
    offset = 0
    PAGE = 1000
    while True:
        chunk = (exec_with_retry(
            sb.table("visits")
              .select("visit_date")
              .gte("visit_date", from_date.isoformat())
              .lte("visit_date", to_date.isoformat())
              .range(offset, offset + PAGE - 1)
        ).data or [])
        all_rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE

    counts: Counter[str] = Counter(
        r["visit_date"] for r in all_rows if r.get("visit_date")
    )
    return [
        {"date": (from_date + timedelta(days=i)).isoformat(),
         "count": counts.get((from_date + timedelta(days=i)).isoformat(), 0)}
        for i in range(total_days)
    ]


@router.get("/referers")
def get_referers(
    days: int = 30,
    start: str | None = Query(default=None, description="시작일 YYYY-MM-DD"),
    end:   str | None = Query(default=None, description="종료일 YYYY-MM-DD"),
) -> list[dict]:
    """기간 내 유입 출처별 방문자 수 (내림차순). referer NULL 인 옛 기록은 '(미상)' 으로 묶음."""
    sb = get_service_client()
    today = date_type.fromisoformat(_today_kst_iso())

    if start and end:
        from_date = date_type.fromisoformat(start)
        to_date   = date_type.fromisoformat(end)
    else:
        from_date = today - timedelta(days=days - 1)
        to_date   = today

    all_rows: list[dict] = []
    offset = 0
    PAGE = 1000
    while True:
        chunk = (exec_with_retry(
            sb.table("visits")
              .select("referer")
              .gte("visit_date", from_date.isoformat())
              .lte("visit_date", to_date.isoformat())
              .range(offset, offset + PAGE - 1)
        ).data or [])
        all_rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE

    counts: Counter[str] = Counter(
        (r.get("referer") or "(미상)") for r in all_rows
    )
    return [{"referer": k, "count": v} for k, v in counts.most_common()]
