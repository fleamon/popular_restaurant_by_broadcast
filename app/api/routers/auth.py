"""인증 보조 — me / grant-admin (회원가입 시 관리자 시크릿으로 권한 획득)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..deps import get_current_user, require_user
from ..services.supabase_client import get_service_client
from ..settings import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
def me(user: dict | None = Depends(get_current_user)) -> dict | None:
    """현재 로그인 사용자 정보. 미로그인이면 null."""
    if not user:
        return None
    # last_login_at 갱신
    try:
        get_service_client().table("users").update({"last_login_at": "now()"}).eq("sequence", user["sequence"]).execute()
    except Exception:
        pass
    return user


class GrantAdminRequest(BaseModel):
    admin_id: str
    admin_password: str


@router.post("/grant-admin")
def grant_admin(body: GrantAdminRequest, user: dict = Depends(require_user)) -> dict:
    """회원가입 직후 호출 — admin id/password 가 시크릿과 일치하면 role='admin' 설정."""
    s = get_settings()
    expected_id = s["admin_signup_id"]
    expected_pw = s["admin_signup_password"]
    if not expected_id or not expected_pw:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="admin signup not configured")
    if body.admin_id != expected_id or body.admin_password != expected_pw:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid admin credentials")

    sb = get_service_client()
    sb.table("users").update({"role": "admin"}).eq("sequence", user["sequence"]).execute()
    return {"ok": True, "role": "admin"}
