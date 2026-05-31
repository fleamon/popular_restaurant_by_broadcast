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
from ..services.youtube_sync import sync_stream

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

ALLOWED_TABLES = {"channels", "restaurants", "appearances"}


def _guard(table: str) -> None:
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"table not editable: {table}")


# ─── 채널 자동 수집 (superadmin) ────────────────────────────────────
# ⚠ 라우트 순서 주의: 아래 `/{table}` 와일드카드보다 먼저 등록해야 매칭이 안 가로채진다.
class IngestBody(BaseModel):
    handle: str           # "@sungsikyung" 또는 https://www.youtube.com/@sungsikyung
    max_videos: int = 10  # 한 번에 처리할 영상 수 (1~100)


@router.post("/ingest-channel")
def ingest_channel(body: IngestBody, user: dict = Depends(require_superadmin)) -> StreamingResponse:
    """채널 핸들 → YouTube → OpenAI 추출 → Kakao 보강 → DB 저장. SSE 스트림으로 진행 상황 전송."""
    if body.max_videos < 1 or body.max_videos > 1000:
        raise HTTPException(status_code=400, detail="max_videos 는 1~1000 사이")

    def event_stream():
        for event in ingest_channel_stream(body.handle, body.max_videos, user["sequence"]):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # nginx 류 프록시에서 버퍼링 방지
    })


# ─── YouTube 데이터 동기화 (superadmin) ──────────────────────────────
# 저장한 영상 제목/썸네일 갱신 + 삭제된 영상 정리. YouTube API 약관(주기적 갱신·동기 삭제) 준수.
# 25일 주기 cron(.github/workflows/youtube-sync.yml)으로 자동 실행 + 여기서 수동 실행.
@router.post("/sync-youtube")
def sync_youtube(_: dict = Depends(require_superadmin)) -> StreamingResponse:
    """appearances 의 YouTube 영상을 공식 API 로 재조회 → 갱신/삭제. SSE 스트림."""
    def event_stream():
        for event in sync_stream():
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


# ─── 일반 테이블 CRUD ────────────────────────────────────────────────
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
