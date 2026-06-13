"""Pydantic 스키마 — 요청 본문 검증용.

응답은 라우터가 Supabase row(dict)를 그대로 반환하므로 응답 모델은 두지 않는다.
(과거 Channel/Restaurant/Appearance/RankingRow 응답 모델은 미사용이라 제거.)
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ChannelType = Literal["tv", "youtube", "blog", "other"]
VoteTarget = Literal["restaurant", "channel", "appearance"]


class VoteRequest(BaseModel):
    target_type: VoteTarget
    target_id: int
    value: Literal[1, -1] = Field(description="1=좋아요, -1=싫어요(레거시, UI 미노출)")
