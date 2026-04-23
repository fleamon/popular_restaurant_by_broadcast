"""namu.wiki 파서. 나무위키는 robots/rate-limit 이 엄격하므로 수동 실행 기준으로만 사용."""
from __future__ import annotations

from typing import Iterable

import requests
from bs4 import BeautifulSoup


def fetch_html(url: str, timeout: float = 15.0) -> str:
    res = requests.get(url, timeout=timeout, headers={"User-Agent": "baekahn-matjido/0.1"})
    res.raise_for_status()
    return res.text


def parse_restaurants(html: str) -> list[dict]:
    """나무위키 목록 추출 스텁. 실제 페이지 구조에 맞춰 선택자 커스터마이징 필요."""
    soup = BeautifulSoup(html, "lxml")
    results: list[dict] = []
    for li in soup.select("li"):
        text = li.get_text(" ", strip=True)
        if len(text) < 4 or len(text) > 200:
            continue
        results.append({"raw": text})
    return results


def iter_restaurants(url: str) -> Iterable[dict]:
    yield from parse_restaurants(fetch_html(url))
