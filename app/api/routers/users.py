"""superadmin 전용 — 회원 관리 (목록/검색/role 변경/charge_channel/block)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_superadmin
from ..services.supabase_client import get_service_client

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_superadmin)])


@router.get("")
def list_users(
    q: str | None = Query(default=None, description="email/nickname like 검색"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict:
    sb = get_service_client()
    query = sb.table("users").select("*", count="exact").order("sequence", desc=True)
    if q:
        # email OR nickname like — Supabase or() 문법
        query = query.or_(f"email.ilike.%{q}%,nickname.ilike.%{q}%")
    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.range(start, end).execute()
    return {"data": res.data or [], "total": res.count or 0, "page": page, "page_size": page_size}


class UserUpdate(BaseModel):
    role: str | None = None
    charge_channel: list[str] | None = None
    is_blocked: bool | None = None
    nickname: str | None = None


@router.patch("/{seq}")
def update_user(seq: int, body: UserUpdate) -> dict:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="empty update")
    if "role" in payload and payload["role"] not in ("superadmin", "admin", "user"):
        raise HTTPException(status_code=400, detail="invalid role")

    sb = get_service_client()

    # charge_channel 갱신 시 — 누락된 채널을 channels 테이블에 자동 생성.
    # 이래야 admin 의 맛집 입력 select 가 실제 DB row 와 매칭되고, 검색 필터에도 노출됨.
    if "charge_channel" in payload and payload["charge_channel"]:
        names: list[str] = [n.strip() for n in payload["charge_channel"] if n and n.strip()]
        payload["charge_channel"] = names  # strip 다시 강제
        if names:
            existing = sb.table("channels").select("name").in_("name", names).execute().data or []
            have = {r["name"] for r in existing}
            missing = [n for n in names if n not in have]
            if missing:
                sb.table("channels").insert(
                    [{"name": n, "channel_type": "other"} for n in missing]
                ).execute()

    res = sb.table("users").update(payload).eq("sequence", seq).execute()
    return {"data": res.data}
