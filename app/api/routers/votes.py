"""좋아요/싫어요 투표 — 음식점/채널/영상 모두 동일 모델.

규칙:
- user 당 (target_type, target_id) **하루 1회** (KST 기준).
- 같은 값 재클릭 → 오늘 분 취소(DELETE). 반대 값 클릭 → 오늘 분 갱신(UPDATE). 없으면 신규(INSERT).
- 어제 이전 분은 그대로 누적 — 매일 한 표씩 쌓이는 구조이고 집계 뷰가 그대로 합산함.
- '하루' 경계는 KST. DB 의 generated column `vote_date` 가 같은 정의로 유니크/조회 일관성 보장.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_user
from ..models.schemas import VoteRequest, VoteTarget
from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/votes", tags=["votes"])

_KST = timezone(timedelta(hours=9))


def _today_kst_iso() -> str:
    return datetime.now(_KST).date().isoformat()


@router.post("")
def cast_vote(body: VoteRequest, user: dict = Depends(require_user)) -> dict:
    """오늘(KST) 한 표를 set/toggle.

    Supabase upsert 는 generated 컬럼(vote_date) 을 포함한 conflict key 와 잘 안 맞아 select-후-쓰기 로 처리.
    동일 사용자의 동시 클릭 race 는 traffic 상 사실상 발생하지 않아 락 생략.
    """
    sb = get_service_client()
    today = _today_kst_iso()
    try:
        existing = exec_with_retry(
            sb.table("votes").select("id, value")
              .eq("user_id", user["sequence"])
              .eq("target_type", body.target_type)
              .eq("target_id", body.target_id)
              .eq("vote_date", today)
              .limit(1)
        ).data or []
        if existing:
            row = existing[0]
            if row["value"] == body.value:
                exec_with_retry(sb.table("votes").delete().eq("id", row["id"]))
            else:
                exec_with_retry(sb.table("votes").update({"value": body.value}).eq("id", row["id"]))
        else:
            exec_with_retry(sb.table("votes").insert({
                "user_id": user["sequence"],
                "target_type": body.target_type,
                "target_id": body.target_id,
                "value": body.value,
            }))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"vote failed: {e}")
    return {"ok": True}


@router.delete("")
def retract_vote(
    target_type: VoteTarget = Query(...),
    target_id: int = Query(...),
    user: dict = Depends(require_user),
) -> dict:
    """오늘(KST) 분 투표만 취소. 어제 이전 표는 그대로 둠."""
    sb = get_service_client()
    exec_with_retry(sb.table("votes").delete()
        .eq("user_id", user["sequence"])
        .eq("target_type", target_type)
        .eq("target_id", target_id)
        .eq("vote_date", _today_kst_iso())
    )
    return {"ok": True}


@router.get("/mine")
def my_votes(target_type: VoteTarget = Query(...), user: dict = Depends(require_user)) -> dict:
    """오늘(KST) 분 내 투표 — 버튼의 활성 상태 표시용.

    어제 이전 표는 누적 점수에는 반영되지만 여기서는 반환하지 않음 → 매일 새로 한 표를 행사할 수 있다는 신호.
    """
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("votes").select("target_id, value")
          .eq("user_id", user["sequence"])
          .eq("target_type", target_type)
          .eq("vote_date", _today_kst_iso())
    ).data or []
    return {str(r["target_id"]): r["value"] for r in rows}
