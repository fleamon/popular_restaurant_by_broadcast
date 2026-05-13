"""좋아요/싫어요 투표 — 음식점/채널/영상 모두 동일 모델.

규칙:
- user 당 (target_type, target_id) 1회 — 같은 값 재클릭 시 취소(DELETE), 반대 값 클릭 시 갱신(UPSERT).
- 토글 로직은 프런트에서 처리 — 서버는 단순히 set/delete.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_user
from ..models.schemas import VoteRequest, VoteTarget
from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/votes", tags=["votes"])


@router.post("")
def cast_vote(body: VoteRequest, user: dict = Depends(require_user)) -> dict:
    """user당 (target_type,target_id) 1회. 재호출 시 값 갱신(upsert)."""
    sb = get_service_client()
    payload = {
        "user_id": user["sequence"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "value": body.value,
    }
    try:
        exec_with_retry(sb.table("votes").upsert(payload, on_conflict="user_id,target_type,target_id"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"vote failed: {e}")
    return {"ok": True}


@router.delete("")
def retract_vote(
    target_type: VoteTarget = Query(...),
    target_id: int = Query(...),
    user: dict = Depends(require_user),
) -> dict:
    """투표 취소 — DELETE-with-body 는 일부 클라이언트가 body 를 떼므로 쿼리스트링으로 받음."""
    sb = get_service_client()
    exec_with_retry(sb.table("votes").delete().match({
        "user_id": user["sequence"],
        "target_type": target_type,
        "target_id": target_id,
    }))
    return {"ok": True}


@router.get("/mine")
def my_votes(target_type: VoteTarget = Query(...), user: dict = Depends(require_user)) -> dict:
    """현재 로그인 user 가 target_type 에 대해 투표한 값들. 키=str(target_id), 값=1/-1.

    UI 는 이 맵으로 각 항목의 현재 내 투표 상태를 표시해, 토글/취소를 정확히 처리.
    """
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("votes").select("target_id, value")
          .eq("user_id", user["sequence"]).eq("target_type", target_type)
    ).data or []
    return {str(r["target_id"]): r["value"] for r in rows}
