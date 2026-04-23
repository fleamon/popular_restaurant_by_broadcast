"""ko.wikipedia.org 파서. 함수형 — HTML in, dict list out."""
from __future__ import annotations

from typing import Iterable

import requests
from bs4 import BeautifulSoup


def fetch_html(url: str, timeout: float = 10.0) -> str:
    res = requests.get(url, timeout=timeout, headers={"User-Agent": "baekahn-matjido/0.1"})
    res.raise_for_status()
    return res.text


def parse_restaurants(html: str) -> list[dict]:
    """위키피디아 페이지에서 맛집 후보를 추출.

    TODO: 실제 위키 페이지별로 구조가 달라 커스텀 파싱 필요. 여기서는 테이블 row 를
    단순 dict 로 변환해 다음 단계(transform)에서 정규화하도록 남긴다.
    """
    soup = BeautifulSoup(html, "lxml")
    results: list[dict] = []
    for table in soup.select("table.wikitable"):
        headers = [th.get_text(strip=True) for th in table.select("tr th")]
        for tr in table.select("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in tr.select("td")]
            if not cells:
                continue
            results.append(dict(zip(headers, cells)))
    return results


def iter_restaurants(url: str) -> Iterable[dict]:
    yield from parse_restaurants(fetch_html(url))
