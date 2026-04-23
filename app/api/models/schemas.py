"""Pydantic 스키마 — DB row ↔ API 응답 사이 경계."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


ChannelType = Literal["tv", "youtube", "blog", "other"]
VoteTarget = Literal["restaurant", "channel", "appearance"]


class Channel(BaseModel):
    id: int
    name: str
    channel_type: ChannelType
    platform: str | None = None
    wiki_url: str | None = None
    thumbnail_url: str | None = None


class Restaurant(BaseModel):
    id: int
    current_name: str
    previous_name: str | None = None
    current_address: str
    previous_address: str | None = None
    cuisine: str | None = None
    sido: str | None = None
    sigungu: str | None = None
    dong: str | None = None
    lat: float | None = None
    lng: float | None = None
    naver_map_url: str | None = None
    kakao_map_url: str | None = None
    naver_rating: float | None = None
    kakao_rating: float | None = None
    is_closed: bool = False
    notes: str | None = None


class Appearance(BaseModel):
    id: int
    restaurant_id: int
    channel_id: int
    aired_at: date | None = None
    episode_title: str | None = None
    source_url: str | None = None
    summary: str | None = None


class RankingRow(BaseModel):
    id: int
    name: str
    likes: int = 0
    dislikes: int = 0
    net_score: int = 0


class VoteRequest(BaseModel):
    target_type: VoteTarget
    target_id: int
    value: Literal[1, -1] = Field(description="1=좋아요, -1=싫어요")
