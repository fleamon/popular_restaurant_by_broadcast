"""방문자 통계 — 좌측 하단 위젯 (오늘 / 총 unique 방문자) + 일별 추이."""
from __future__ import annotations

from collections import Counter
from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/visits", tags=["visits"])

_KST = timezone(timedelta(hours=9))


def _today_kst_iso() -> str:
    return datetime.now(_KST).date().isoformat()


class TrackBody(BaseModel):
    visitor_id: str = Field(min_length=4, max_length=64)


@router.post("/track")
def track_visit(body: TrackBody) -> dict:
    """visitor_id 의 오늘(KST) 방문 1건 기록.
    (visitor_id, visit_date) UNIQUE 인덱스라 같은 device 가 하루에 여러 번 와도 1회만.
    """
    sb = get_service_client()
    try:
        # ON CONFLICT 회피 — upsert 로 충돌 무시. visit_date 는 generated 라 insert payload 에 없음.
        sb.table("visits").upsert(
            {"visitor_id": body.visitor_id},
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

    # 총 unique visitor 카운트 — distinct visitor_id.
    # PostgREST 가 distinct count 를 직접 지원하지 않아 visitor_id 전체를 페이지 누적으로 받고 메모리에서 unique.
    # 운영 초기엔 수 천~수 만 단위. 더 커지면 RPC/뷰로 분리 권장.
    all_ids: set[str] = set()
    start = 0
    PAGE = 1000
    while True:
        chunk = exec_with_retry(
            sb.table("visits").select("visitor_id").range(start, start + PAGE - 1)
        ).data or []
        for r in chunk:
            vid = r.get("visitor_id")
            if vid:
                all_ids.add(vid)
        if len(chunk) < PAGE:
            break
        start += PAGE

    return {"today": today_count, "total": len(all_ids)}


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
