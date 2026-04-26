"""정규화·지오코딩 — raw dict → restaurants 테이블 스키마에 맞춘 dict.

TODO: 실제 파서 결과 컬럼명은 페이지마다 다름. 여기서는 공통적으로 등장하는 키를
느슨하게 매핑하고, 나머지는 notes 에 원본을 남긴다.
"""
from __future__ import annotations

from typing import Any

from sources.maps import kakao_geocode, kakao_place_url, naver_place_url

NAME_KEYS    = ("가게", "상호", "식당", "상점", "name", "업체")
ADDRESS_KEYS = ("주소", "소재지", "위치", "address")
CUISINE_KEYS = ("분류", "종류", "장르", "cuisine")


def _first(row: dict, keys: tuple[str, ...]) -> str | None:
    for k in keys:
        if k in row and row[k]:
            return str(row[k]).strip()
    return None


def normalize(raw: dict) -> dict[str, Any] | None:
    """raw(위키 row) → restaurants insert payload. 이름·주소 없으면 None."""
    name = _first(raw, NAME_KEYS)
    address = _first(raw, ADDRESS_KEYS)
    if not name or not address:
        return None

    payload: dict[str, Any] = {
        "current_name": name,
        "current_address": address,
        "cuisine": _first(raw, CUISINE_KEYS),
        "naver_map_url": naver_place_url(name),
        "kakao_map_url": kakao_place_url(name),
    }

    # 주소에서 시도/구군 대략 추출 (느슨한 규칙)
    tokens = address.split()
    if tokens:
        payload["sido"] = tokens[0]
        if len(tokens) > 1:
            payload["sigungu"] = tokens[1]

    coords = kakao_geocode(address)
    if coords:
        payload["lat"], payload["lng"] = coords

    return payload
