"""YouTube Data API v3 클라이언트 — 채널 핸들 풀이 → 업로드 영상 목록 조회.

함수형: 부작용 없는 순수 GET 호출만. 키는 settings 에서 한 번 읽음.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import httpx

from ..settings import get_settings

_BASE = "https://www.googleapis.com/youtube/v3"
_TIMEOUT = 15.0


@dataclass(frozen=True)
class VideoMeta:
    video_id: str
    title: str
    description: str
    published_at: str | None
    thumbnail_url: str | None


@dataclass(frozen=True)
class ChannelMeta:
    channel_id: str           # UC... (YouTube 내부 id)
    title: str                # 채널 이름 (예: "성시경 SUNG SI KYUNG")
    uploads_playlist_id: str  # 업로드 영상 재생목록 id (UU...)
    thumbnail_url: str | None


def _api_key() -> str:
    key = get_settings()["youtube_api_key"]
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY 가 설정되지 않음 (config/secrets.json → youtube.api_key)")
    return key


def _get(path: str, params: dict) -> dict:
    params = {**params, "key": _api_key()}
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.get(f"{_BASE}{path}", params=params)
        r.raise_for_status()
        return r.json()


def resolve_handle(handle: str) -> ChannelMeta:
    """@xxx 핸들 또는 채널 URL → 채널 메타. 못 찾으면 RuntimeError."""
    # 입력 정규화: '@xxx' / 'https://youtube.com/@xxx' / 'https://www.youtube.com/channel/UC...'
    h = (handle or "").strip()
    if h.startswith("http"):
        # URL 에서 핸들이나 채널 id 추출
        if "/@" in h:
            h = "@" + h.split("/@", 1)[1].split("/")[0].split("?")[0]
        elif "/channel/" in h:
            cid = h.split("/channel/", 1)[1].split("/")[0].split("?")[0]
            return _channel_by_id(cid)
        else:
            raise RuntimeError(f"지원하지 않는 URL 형식: {handle}")
    if not h.startswith("@"):
        h = "@" + h.lstrip("@")
    data = _get("/channels", {
        "part": "id,snippet,contentDetails",
        "forHandle": h,
    })
    items = data.get("items") or []
    if not items:
        raise RuntimeError(f"채널을 찾지 못함: {handle}")
    return _to_channel_meta(items[0])


def _channel_by_id(channel_id: str) -> ChannelMeta:
    data = _get("/channels", {
        "part": "id,snippet,contentDetails",
        "id": channel_id,
    })
    items = data.get("items") or []
    if not items:
        raise RuntimeError(f"채널을 찾지 못함: {channel_id}")
    return _to_channel_meta(items[0])


def _to_channel_meta(item: dict) -> ChannelMeta:
    snippet = item.get("snippet") or {}
    related = (item.get("contentDetails") or {}).get("relatedPlaylists") or {}
    thumbs = snippet.get("thumbnails") or {}
    # 'high' → 'medium' → 'default' 우선순위
    thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
    return ChannelMeta(
        channel_id=item["id"],
        title=snippet.get("title") or "",
        uploads_playlist_id=related.get("uploads") or "",
        thumbnail_url=thumb,
    )


def playlist_video_ids(playlist_id: str, max_count: int) -> list[str]:
    """업로드 재생목록 → 최신순 video_id 목록 (최대 max_count 개)."""
    out: list[str] = []
    page_token: str | None = None
    while len(out) < max_count:
        params = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": min(50, max_count - len(out)),
        }
        if page_token:
            params["pageToken"] = page_token
        data = _get("/playlistItems", params)
        for it in data.get("items") or []:
            vid = (it.get("contentDetails") or {}).get("videoId")
            if vid:
                out.append(vid)
            if len(out) >= max_count:
                break
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return out


def videos_detail(video_ids: Iterable[str]) -> list[VideoMeta]:
    """video_id 목록 → 제목/설명/게시일/썸네일. 50개씩 묶어 호출."""
    ids = [v for v in video_ids if v]
    out: list[VideoMeta] = []
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        data = _get("/videos", {
            "part": "snippet",
            "id": ",".join(chunk),
        })
        for it in data.get("items") or []:
            sn = it.get("snippet") or {}
            thumbs = sn.get("thumbnails") or {}
            thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
            out.append(VideoMeta(
                video_id=it.get("id") or "",
                title=sn.get("title") or "",
                description=sn.get("description") or "",
                published_at=sn.get("publishedAt"),
                thumbnail_url=thumb,
            ))
    return out
