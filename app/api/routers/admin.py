"""DB 관리 — admin 전용 CRUD + 채널 자동 수집(superadmin)."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..deps import require_admin, require_superadmin
from ..services.ingest_channel import ingest_channel_stream
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


# ─── 채널 자동 수집 (superadmin) ────────────────────────────────────
class IngestBody(BaseModel):
    handle: str           # "@sungsikyung" 또는 https://www.youtube.com/@sungsikyung
    max_videos: int = 10  # 한 번에 처리할 영상 수 (1~100)


@router.post("/ingest-channel")
def ingest_channel(body: IngestBody, user: dict = Depends(require_superadmin)) -> StreamingResponse:
    """채널 핸들 → YouTube → OpenAI 추출 → Kakao 보강 → DB 저장. SSE 스트림으로 진행 상황 전송."""
    if body.max_videos < 1 or body.max_videos > 100:
        raise HTTPException(status_code=400, detail="max_videos 는 1~100 사이")

    def event_stream():
        for event in ingest_channel_stream(body.handle, body.max_videos, user["sequence"]):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # nginx 류 프록시에서 버퍼링 방지
    })
