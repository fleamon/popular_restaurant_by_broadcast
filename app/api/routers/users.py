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

    # charge_channel 정규화 (strip + 빈 문자열 제거 + dedupe)
    if "charge_channel" in payload:
        raw = payload["charge_channel"] or []
        names = list(dict.fromkeys(n.strip() for n in raw if n and n.strip()))
        payload["charge_channel"] = names

    res = sb.table("users").update(payload).eq("sequence", seq).execute()

    # charge_channel 갱신 후 — channels 테이블을 모든 회원의 distinct(union) 와 동기화.
    #   ① 새로 등장한 이름은 channels 에 INSERT (channel_type='other' 기본값)
    #   ② 어떤 회원의 charge_channel 에도 없는 채널은 channels 에서 DELETE
    #      단, appearances 가 연결된 채널은 데이터 보호를 위해 유지 (orphan 방지)
    if "charge_channel" in payload:
        all_users = sb.table("users").select("charge_channel").execute().data or []
        distinct: set[str] = set()
        for u in all_users:
            for n in (u.get("charge_channel") or []):
                if n:
                    distinct.add(n)

        current = sb.table("channels").select("id, name").execute().data or []
        current_names = {c["name"] for c in current}

        # ① INSERT missing
        to_add = distinct - current_names
        if to_add:
            sb.table("channels").insert(
                [{"name": n, "channel_type": "other"} for n in to_add]
            ).execute()

        # ② DELETE 채널 — distinct 에 없고 + appearances 0 개인 것만
        for c in current:
            if c["name"] in distinct:
                continue
            apps = sb.table("appearances").select("id").eq("channel_id", c["id"]).limit(1).execute().data or []
            if apps:
                continue   # 실제 사용중인 채널은 보존
            sb.table("channels").delete().eq("id", c["id"]).execute()

    return {"data": res.data}
