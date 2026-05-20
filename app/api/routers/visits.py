"""방문자 통계 — 좌측 하단 위젯 (오늘 / 총 unique 방문자)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
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
