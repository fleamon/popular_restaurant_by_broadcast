"""FastAPI 의존성 — 인증 사용자 주입, admin 가드."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from .services.supabase_client import get_anon_client, get_service_client


def get_current_user(authorization: str | None = Header(default=None)) -> dict | None:
    """Bearer 토큰에서 Supabase 사용자 해석. 없으면 None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        resp = get_anon_client().auth.get_user(token)
        return resp.user.model_dump() if resp and resp.user else None
    except Exception:
        return None


def require_user(user: dict | None = Depends(get_current_user)) -> dict:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="login required")
    return user


def require_admin(user: dict = Depends(require_user)) -> dict:
    svc = get_service_client()
    profile = svc.table("profiles").select("is_admin").eq("id", user["id"]).single().execute()
    if not (profile.data and profile.data.get("is_admin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return user
