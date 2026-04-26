"""추출 단계 — 채널의 wiki_url 에서 맛집 후보 dict 리스트 반환.

순수함수: 네트워크 fetch 는 sources/* 에 위임. wiki/namuwiki URL 자동 라우팅.
"""
from __future__ import annotations

from sources import namuwiki, wiki


def is_namuwiki(url: str) -> bool:
    return "namu.wiki" in url


def extract_for_channel(channel: dict) -> list[dict]:
    url = channel.get("wiki_url") or ""
    if not url:
        return []
    parser = namuwiki if is_namuwiki(url) else wiki
    return list(parser.iter_restaurants(url))
