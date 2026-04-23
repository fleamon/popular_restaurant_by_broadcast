"""DB 관리 — admin 전용 CRUD. 모든 엔드포인트에 require_admin."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..deps import require_admin
from ..services.supabase_client import get_service_client

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

ALLOWED_TABLES = {"channels", "restaurants", "appearances"}


def _guard(table: str) -> None:
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"table not editable: {table}")


@router.post("/{table}")
def create_row(table: str, payload: dict[str, Any]) -> dict:
    _guard(table)
    res = get_service_client().table(table).insert(payload).execute()
    return {"data": res.data}


@router.patch("/{table}/{row_id}")
def update_row(table: str, row_id: int, payload: dict[str, Any]) -> dict:
    _guard(table)
    res = get_service_client().table(table).update(payload).eq("id", row_id).execute()
    return {"data": res.data}


@router.delete("/{table}/{row_id}")
def delete_row(table: str, row_id: int) -> dict:
    _guard(table)
    get_service_client().table(table).delete().eq("id", row_id).execute()
    return {"ok": True}
