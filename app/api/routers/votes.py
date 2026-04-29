"""좋아요/싫어요 투표 — 음식점/채널/영상 모두 동일 모델."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..deps import require_user
from ..models.schemas import VoteRequest
from ..services.supabase_client import get_service_client

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
        sb.table("votes").upsert(payload, on_conflict="user_id,target_type,target_id").execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"vote failed: {e}")
    return {"ok": True}


@router.delete("")
def retract_vote(body: VoteRequest, user: dict = Depends(require_user)) -> dict:
    sb = get_service_client()
    sb.table("votes").delete().match({
        "user_id": user["sequence"],
        "target_type": body.target_type,
        "target_id": body.target_id,
    }).execute()
    return {"ok": True}
