"""인증 보조 엔드포인트 — 회원가입 자체는 Supabase Auth(클라이언트)에서 직접 처리.
여기서는 어드민 권한 부여 같은 서버 보조 작업만 다룬다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..deps import require_user
from ..services.supabase_client import get_service_client
from ..settings import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class GrantAdminRequest(BaseModel):
    admin_id: str
    admin_password: str


@router.post("/grant-admin")
def grant_admin(body: GrantAdminRequest, user: dict = Depends(require_user)) -> dict:
    """회원가입한 사용자가 admin id/password 를 함께 제출해 어드민 권한 획득.
    config/secrets.json 의 admin.signup_id / admin.signup_password 와 매치되어야 함.
    """
    s = get_settings()
    expected_id = s["admin_signup_id"]
    expected_pw = s["admin_signup_password"]
    if not expected_id or not expected_pw:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="admin signup not configured",
        )
    if body.admin_id != expected_id or body.admin_password != expected_pw:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid admin credentials")

    sb = get_service_client()
    sb.table("profiles").update({"is_admin": True}).eq("id", user["id"]).execute()
    return {"ok": True, "is_admin": True}
