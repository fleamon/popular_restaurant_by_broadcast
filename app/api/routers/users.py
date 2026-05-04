"""superadmin 전용 — 회원 관리 (목록/검색/role 변경/charge_channel/block)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_superadmin
from ..services.supabase_client import get_service_client

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_superadmin)])


def _norm_channel(name: str) -> str:
    """채널명 정규화 — 모든 공백 제거. '맛있는 녀석들' === '맛있는녀석들'."""
    return re.sub(r"\s+", "", (name or "").strip())


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

    # charge_channel 정규화 — 공백 모두 제거 + 빈 문자열 필터 + dedupe
    if "charge_channel" in payload:
        raw = payload["charge_channel"] or []
        names = list(dict.fromkeys(_norm_channel(n) for n in raw if _norm_channel(n)))
        payload["charge_channel"] = names

    res = sb.table("users").update(payload).eq("sequence", seq).execute()

    # charge_channel 갱신 후 — channels 테이블을 모든 회원의 distinct(union) 와 동기화.
    # 비교는 정규화된 이름(공백 제거) 기준 — '맛있는녀석들' 과 '맛있는 녀석들' 을 동일 채널로 취급.
    if "charge_channel" in payload:
        all_users = sb.table("users").select("charge_channel").execute().data or []
        distinct: set[str] = set()
        for u in all_users:
            for n in (u.get("charge_channel") or []):
                norm = _norm_channel(n)
                if norm:
                    distinct.add(norm)

        current = sb.table("channels").select("id, name").execute().data or []
        # normalize 키 → channel row 매핑 (중복은 첫번째 채택)
        current_by_norm: dict[str, dict] = {}
        for c in current:
            current_by_norm.setdefault(_norm_channel(c["name"]), c)

        # ① INSERT — distinct 에 있지만 현재 (정규화 비교) 없는 것
        to_add = distinct - set(current_by_norm.keys())
        if to_add:
            sb.table("channels").insert(
                [{"name": n, "channel_type": "other"} for n in to_add]
            ).execute()

        # ② DELETE — 어떤 회원도 안 쓰고 (정규화 비교) appearances 0 개인 채널
        for norm, c in current_by_norm.items():
            if norm in distinct:
                continue
            apps = sb.table("appearances").select("id").eq("channel_id", c["id"]).limit(1).execute().data or []
            if apps:
                continue  # 실제 사용중인 채널은 보존
            sb.table("channels").delete().eq("id", c["id"]).execute()

    return {"data": res.data}
