"""FastAPI 의존성 — Bearer 토큰 → public.users row 주입, role 기반 가드."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from .services.supabase_client import get_anon_client, get_service_client


def get_current_user(authorization: str | None = Header(default=None)) -> dict | None:
    """Authorization Bearer 토큰을 풀어 public.users row 를 반환. 없으면 None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        resp = get_anon_client().auth.get_user(token)
        auth_user = resp.user.model_dump() if resp and resp.user else None
        if not auth_user:
            return None
        sb = get_service_client()
        row = sb.table("users").select("*").eq("auth_id", auth_user["id"]).single().execute()
        return row.data
    except Exception:
        return None


def require_user(user: dict | None = Depends(get_current_user)) -> dict:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="login required")
    if user.get("is_blocked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="account blocked")
    return user


def require_admin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return user


def require_superadmin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="superadmin only")
    return user
