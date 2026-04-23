"""네이버/카카오 지도 URL·별점 조회 스텁.

- 네이버 지역검색 API: https://developers.naver.com/docs/serviceapi/search/local/local.md
- 카카오 로컬 API: https://developers.kakao.com/docs/latest/ko/local/dev-guide
둘 다 API 키가 있으면 주소·좌표·평점(일부)을 가져올 수 있다. 키가 없으면 URL만 생성.
"""
from __future__ import annotations

import urllib.parse

import requests

from ..utils.config import get_config


def naver_place_url(name: str) -> str:
    return f"https://map.naver.com/v5/search/{urllib.parse.quote(name)}"


def kakao_place_url(name: str) -> str:
    return f"https://map.kakao.com/?q={urllib.parse.quote(name)}"


def kakao_geocode(address: str) -> tuple[float, float] | None:
    """주소 → (lat, lng). 키 없으면 None."""
    key = get_config().get("kakao_rest_api_key")
    if not key:
        return None
    res = requests.get(
        "https://dapi.kakao.com/v2/local/search/address.json",
        params={"query": address},
        headers={"Authorization": f"KakaoAK {key}"},
        timeout=5,
    )
    if res.status_code != 200:
        return None
    docs = res.json().get("documents", [])
    if not docs:
        return None
    d = docs[0]
    return float(d["y"]), float(d["x"])
