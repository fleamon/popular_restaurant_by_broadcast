"""요청 게시판 — 채널 추가/관리자 요청/버그 제보/기타.

접근 정책:
- 목록(`GET /requests`): 누구나. 작성자/상태/타입/제목/생성시각만 노출, 본문 X
- 상세(`GET /requests/{id}`): 작성자 본인 또는 superadmin 만
- 작성(`POST /requests`): 로그인 회원
- 상태 변경(`PATCH /requests/{id}/status`): superadmin
- 삭제(`DELETE /requests/{id}`): superadmin
- 댓글 조회/작성: 작성자 본인 또는 superadmin (양쪽 답변형 대화)
- 채널 부여(`POST /requests/{id}/grant-channel`): superadmin, admin_request 타입만
"""
from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from ..deps import get_current_user, require_superadmin, require_user
from ..services.supabase_client import exec_with_retry, get_service_client

router = APIRouter(prefix="/requests", tags=["requests"])

REQUEST_TYPES = ("channel_add", "admin_request", "bug", "etc", "notice",
                 "restaurant_edit", "restaurant_delete")
REQUEST_STATUSES = ("요청", "처리중", "완료", "반려")

# restaurant_edit/delete payload 적용 시 화이트리스트.
# restaurants.py 의 동일 set 과 일치시켜야 함.
_RESTAURANT_EDITABLE = {
    "current_name", "current_address", "cuisine",
    "sido", "sigungu", "dong", "lat", "lng",
    "naver_map_url", "kakao_map_url", "naver_place_id", "kakao_place_id",
    "phone", "notes",
}
_APPEARANCE_EDITABLE = {
    "channel_id", "episode_title", "source_url", "youtube_video_id",
    "thumbnail_url", "summary", "aired_at",
}


# ─── Schemas ──────────────────────────────────────────────────────
class CreateRequestBody(BaseModel):
    type: Literal["channel_add", "admin_request", "bug", "etc", "notice"]
    title: str
    content: str | None = None
    channel_type: Literal["tv", "youtube", "blog", "other"] | None = None
    channel_url: str | None = None
    channel_id: int | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()

    def validate_for_type(self, user_role: str) -> None:
        """type 별 필수값/길이 검증. notice 는 superadmin 만."""
        if not self.title:
            raise HTTPException(status_code=400, detail="제목이 필수입니다.")

        if self.type == "notice":
            if user_role != "superadmin":
                raise HTTPException(status_code=403, detail="공지사항은 superadmin 만 작성할 수 있습니다.")
            if not (self.content and self.content.strip()):
                raise HTTPException(status_code=400, detail="내용이 필수입니다.")
            # 공지사항은 길이 제한 없음
            return

        # 그 외 타입은 길이 제한 적용
        if len(self.title) > 100:
            raise HTTPException(status_code=400, detail="제목은 최대 100자입니다.")
        if self.content and len(self.content) > 200:
            raise HTTPException(status_code=400, detail="내용은 최대 200자입니다.")

        if self.type == "channel_add":
            if self.channel_url and len(self.channel_url) > 200:
                raise HTTPException(status_code=400, detail="채널 URL 은 최대 200자입니다.")
            if not (self.channel_type and self.channel_url and self.channel_url.strip()):
                raise HTTPException(status_code=400, detail="채널 추가 요청은 channel_type 과 channel_url 이 필수입니다.")
        elif self.type == "admin_request":
            if not self.channel_id:
                raise HTTPException(status_code=400, detail="관리자 요청은 channel_id 가 필수입니다.")
            if not (self.content and self.content.strip()):
                raise HTTPException(status_code=400, detail="관리자 요청은 내용이 필수입니다.")
        elif self.type in ("bug", "etc"):
            if not (self.content and self.content.strip()):
                raise HTTPException(status_code=400, detail="내용이 필수입니다.")


class CommentBody(BaseModel):
    body: str = Field(min_length=1, max_length=100)


class StatusBody(BaseModel):
    status: Literal["요청", "처리중", "완료", "반려"]


# ─── Routes ───────────────────────────────────────────────────────
@router.get("")
def list_requests(
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    user: dict | None = Depends(get_current_user),
) -> list[dict]:
    """목록 — 누구나. 본문/채널 정보 제외, 메타만.

    service client 사용 — users 테이블 RLS 가 anon 권한으로 자기참조 재귀하는 이슈 회피.
    응답에서 본문 (content/channel_url 등) 은 제외하므로 안전.
    """
    sb = get_service_client()
    fields = "id, author_id, type, status, title, created_at, channel_id, users(nickname, email)"

    # 공지사항을 항상 최상단에 배치 — Postgrest 표현식 정렬이 안 되어 두 쿼리로 분리.
    notices_rows: list[dict] = []
    if type is None or type == "notice":
        nq = sb.table("requests").select(fields).eq("type", "notice").order("created_at", desc=True)
        if status: nq = nq.eq("status", status)
        notices_rows = exec_with_retry(nq).data or []

    others_rows: list[dict] = []
    if type != "notice":
        oq = sb.table("requests").select(fields).neq("type", "notice").order("created_at", desc=True)
        if status: oq = oq.eq("status", status)
        if type:   oq = oq.eq("type", type)
        others_rows = exec_with_retry(oq).data or []

    rows = notices_rows + others_rows
    # 작성자 본인 여부 표시 — UI 에서 '내가 쓴 글' 강조 가능
    me_seq = user.get("sequence") if user else None
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "type": r["type"],
            "status": r["status"],
            "title": r["title"],
            "channel_id": r.get("channel_id"),
            "author_nickname": (r.get("users") or {}).get("nickname") or (r.get("users") or {}).get("email"),
            "created_at": r["created_at"],
            "is_mine": me_seq is not None and r["author_id"] == me_seq,
        })
    return out


@router.post("")
def create_request(body: CreateRequestBody, user: dict = Depends(require_user)) -> dict:
    body.validate_for_type(user.get("role", "user"))
    sb = get_service_client()
    payload = body.model_dump(exclude_none=True)
    payload["author_id"] = user["sequence"]
    res = exec_with_retry(sb.table("requests").insert(payload))
    row = res.data[0] if res.data else {}
    return {"id": row.get("id")}


@router.get("/{rid}")
def get_request(rid: int, user: dict | None = Depends(get_current_user)) -> dict:
    """상세 — 공지(notice) 는 누구나, 그 외 타입은 작성자 본인 또는 superadmin 만."""
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("requests").select("*, users(nickname, email), channels(name)").eq("id", rid)
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="not found")
    row = rows[0]
    is_notice = row["type"] == "notice"
    is_owner = bool(user) and row["author_id"] == user["sequence"]
    is_super = bool(user) and user.get("role") == "superadmin"
    if not (is_notice or is_owner or is_super):
        if not user:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
        raise HTTPException(status_code=403, detail="작성자 또는 superadmin 만 열람 가능")
    return {
        **row,
        "author_nickname": (row.get("users") or {}).get("nickname") or (row.get("users") or {}).get("email"),
        "channel_name": (row.get("channels") or {}).get("name"),
        "is_mine": is_owner,
        "can_manage": is_super,
    }


@router.patch("/{rid}/status")
def update_status(rid: int, body: StatusBody, _: dict = Depends(require_superadmin)) -> dict:
    sb = get_service_client()
    exec_with_retry(sb.table("requests").update({"status": body.status}).eq("id", rid))
    return {"ok": True}


@router.delete("/{rid}")
def delete_request(rid: int, user: dict = Depends(require_user)) -> dict:
    """요청 단건 삭제 — 작성자 본인 또는 superadmin. 댓글은 FK ON DELETE CASCADE."""
    sb = get_service_client()
    rows = exec_with_retry(sb.table("requests").select("author_id").eq("id", rid)).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="not found")
    is_owner = rows[0]["author_id"] == user["sequence"]
    is_super = user.get("role") == "superadmin"
    if not (is_owner or is_super):
        raise HTTPException(status_code=403, detail="작성자 본인 또는 superadmin 만 삭제 가능")
    exec_with_retry(sb.table("requests").delete().eq("id", rid))
    return {"ok": True}


class BulkDeleteBody(BaseModel):
    ids: list[int]


@router.post("/bulk-delete")
def bulk_delete_requests(body: BulkDeleteBody, _: dict = Depends(require_superadmin)) -> dict:
    """요청 다중 삭제 — superadmin 만. 댓글은 cascade 로 자동 정리."""
    if not body.ids:
        return {"ok": True, "deleted": 0}
    sb = get_service_client()
    # IN 절 URL 길이 한계 회피 — 500개씩 청크
    CHUNK = 500
    for i in range(0, len(body.ids), CHUNK):
        exec_with_retry(sb.table("requests").delete().in_("id", body.ids[i:i + CHUNK]))
    return {"ok": True, "deleted": len(body.ids)}


def _norm_channel(name: str) -> str:
    return re.sub(r"\s+", "", (name or "").strip())


@router.post("/{rid}/grant-channel")
def grant_channel(rid: int, _: dict = Depends(require_superadmin)) -> dict:
    """관리자 요청 — 요청한 user 의 charge_channel 배열에 그 채널 이름 추가.

    user.role 이 'user' 면 'admin' 으로 함께 승격 (charge_channel 만 추가하면 사실상 무용).
    이미 같은 채널이 있으면 noop, role 도 그대로.
    """
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("requests").select("author_id, channel_id, type, channels(name)").eq("id", rid)
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="not found")
    r = rows[0]
    if r["type"] != "admin_request":
        raise HTTPException(status_code=400, detail="admin_request 타입에서만 사용 가능합니다.")
    if not r.get("channel_id"):
        raise HTTPException(status_code=400, detail="요청에 채널 정보가 없습니다.")
    channel_name = ((r.get("channels") or {}).get("name") or "").strip()
    if not channel_name:
        raise HTTPException(status_code=404, detail="채널 이름을 찾을 수 없습니다.")

    user_rows = exec_with_retry(
        sb.table("users").select("sequence, charge_channel, role, email, nickname").eq("sequence", r["author_id"])
    ).data or []
    if not user_rows:
        raise HTTPException(status_code=404, detail="요청자 user 가 없습니다.")
    u = user_rows[0]
    current = list(u.get("charge_channel") or [])
    norm_target = _norm_channel(channel_name)
    already = any(_norm_channel(c) == norm_target for c in current)

    patch: dict = {}
    if not already:
        patch["charge_channel"] = current + [channel_name]
    # role 'user' → 'admin' 승격 (이미 admin/superadmin 이면 유지)
    role_upgraded = False
    if u.get("role") == "user":
        patch["role"] = "admin"
        role_upgraded = True

    if patch:
        exec_with_retry(sb.table("users").update(patch).eq("sequence", r["author_id"]))

    return {
        "ok": True,
        "channel": channel_name,
        "added": not already,
        "role_upgraded": role_upgraded,
        "user": u.get("nickname") or u.get("email"),
    }


# ─────────────────────────────────────────────────────────────────────
# 맛집/영상 수정·삭제 요청의 승인 적용 — superadmin 전용
# ─────────────────────────────────────────────────────────────────────

def _filter(payload: dict | None, allowed: set[str]) -> dict:
    if not payload:
        return {}
    return {k: v for k, v in payload.items() if k in allowed}


@router.post("/{rid}/apply-restaurant-edit")
def apply_restaurant_edit(rid: int, _: dict = Depends(require_superadmin)) -> dict:
    """restaurant_edit 요청의 payload 를 실제 restaurants/appearances 에 반영.
    적용 후 요청 status='완료' 로 마킹.
    """
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("requests").select("*").eq("id", rid)
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="not found")
    r = rows[0]
    if r["type"] != "restaurant_edit":
        raise HTTPException(status_code=400, detail="restaurant_edit 타입에서만 사용 가능합니다.")

    payload = r.get("payload") or {}
    rest_patch = _filter(payload.get("restaurant"), _RESTAURANT_EDITABLE)
    app_patch  = _filter(payload.get("appearance"), _APPEARANCE_EDITABLE)
    if not rest_patch and not app_patch:
        raise HTTPException(status_code=400, detail="적용할 변경 내용이 없습니다.")

    if rest_patch and r.get("restaurant_id"):
        exec_with_retry(sb.table("restaurants").update(rest_patch).eq("id", r["restaurant_id"]))
    if app_patch and r.get("appearance_id"):
        exec_with_retry(sb.table("appearances").update(app_patch).eq("id", r["appearance_id"]))

    exec_with_retry(sb.table("requests").update({"status": "완료"}).eq("id", rid))
    return {"ok": True, "restaurant_updated": bool(rest_patch), "appearance_updated": bool(app_patch)}


@router.post("/{rid}/apply-restaurant-delete")
def apply_restaurant_delete(rid: int, _: dict = Depends(require_superadmin)) -> dict:
    """restaurant_delete 요청 적용 — 해당 appearance 삭제. 맛집은 그대로 (다른 영상이 가리킬 수 있음)."""
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("requests").select("*").eq("id", rid)
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="not found")
    r = rows[0]
    if r["type"] != "restaurant_delete":
        raise HTTPException(status_code=400, detail="restaurant_delete 타입에서만 사용 가능합니다.")
    aid = r.get("appearance_id")
    if aid:
        exec_with_retry(sb.table("appearances").delete().eq("id", aid))
    exec_with_retry(sb.table("requests").update({"status": "완료"}).eq("id", rid))
    return {"ok": True, "deleted_appearance_id": aid}


@router.get("/{rid}/comments")
def list_comments(rid: int, user: dict = Depends(require_user)) -> list[dict]:
    """댓글 목록 — 작성자 본인 또는 superadmin."""
    sb = get_service_client()
    parent = exec_with_retry(sb.table("requests").select("author_id").eq("id", rid)).data or []
    if not parent:
        raise HTTPException(status_code=404, detail="not found")
    is_owner = parent[0]["author_id"] == user["sequence"]
    is_super = user.get("role") == "superadmin"
    if not (is_owner or is_super):
        raise HTTPException(status_code=403, detail="작성자 또는 superadmin 만 열람 가능")
    rows = exec_with_retry(
        sb.table("request_comments").select("id, request_id, author_id, body, created_at, users(nickname, email, role)")
          .eq("request_id", rid).order("created_at")
    ).data or []
    out = []
    for r in rows:
        u = r.get("users") or {}
        out.append({
            "id": r["id"],
            "request_id": r["request_id"],
            "author_id": r["author_id"],
            "body": r["body"],
            "created_at": r["created_at"],
            "author_nickname": u.get("nickname") or u.get("email"),
            "author_role": u.get("role"),
        })
    return out


@router.post("/{rid}/comments")
def create_comment(rid: int, body: CommentBody, user: dict = Depends(require_user)) -> dict:
    sb = get_service_client()
    parent = exec_with_retry(sb.table("requests").select("author_id").eq("id", rid)).data or []
    if not parent:
        raise HTTPException(status_code=404, detail="not found")
    is_owner = parent[0]["author_id"] == user["sequence"]
    is_super = user.get("role") == "superadmin"
    if not (is_owner or is_super):
        raise HTTPException(status_code=403, detail="작성자 또는 superadmin 만 작성 가능")
    res = exec_with_retry(sb.table("request_comments").insert({
        "request_id": rid,
        "author_id": user["sequence"],
        "body": body.body.strip(),
    }))
    row = res.data[0] if res.data else {}
    return {"id": row.get("id")}
