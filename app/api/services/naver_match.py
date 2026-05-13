"""네이버 place 매칭 — 가게이름·주소·좌표로 정확한 naver place_id 찾기.

전략:
1. 분점 접미사(본점/분점/지점/직영점/N호점/...) 를 점진 제거한 가게이름 변형 생성
2. 각 변형 + 시/구/동 으로 m.map.naver.com 검색 페이지 GET → SSR 응답에서 /place/{id} 추출
3. summary API 로 좌표 검증 — 우리 카카오 좌표와 거리 ≤ 300m 면 매칭 성공
4. 변형 모두 실패 → None

m.map.naver.com 의 모바일 검색 페이지가 SSR 형태로 첫 결과 페이지 ID 를 본문에 포함시켜준다.
같은 URL 을 데스크탑(map.naver.com) 으로 호출하면 SPA 라 빈 본문.
"""
from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass

import httpx

_PLACE_ID_RX = re.compile(r"/place/(\d+)")
_BRANCH_SUFFIX_RX = re.compile(r"(\d+호점|본점|분점|지점|직영점|역점)$")

_SEARCH_URL = "https://m.map.naver.com/search2/search.naver"
_SUMMARY_URL = "https://map.naver.com/p/api/place/summary/{}"

_HEADERS_SEARCH = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Accept-Language": "ko-KR,ko;q=0.9",
}
_HEADERS_SUMMARY = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://map.naver.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
}


@dataclass(frozen=True)
class NaverMatch:
    place_id: str
    lat: float
    lng: float
    distance_m: float
    matched_query: str  # 어느 변형으로 매칭됐는지 (디버그)


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 위경도 사이 거리(미터). Haversine 공식."""
    R = 6371000.0
    p = math.pi / 180
    a = (
        0.5 - math.cos((lat2 - lat1) * p) / 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lng2 - lng1) * p)) / 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def _name_variants(name: str) -> list[str]:
    """가게이름의 분점 접미사 제거 변형 — kakao_geo._name_variants 와 같은 패턴."""
    name = (name or "").strip()
    if not name:
        return []
    out: list[str] = [name]
    parts = name.split()
    if len(parts) < 2 or not parts[-1].endswith("점"):
        return out
    last = parts[-1]
    m = _BRANCH_SUFFIX_RX.search(last)
    if m:
        # 본점/분점/지점/직영점/N호점/역점 통째로 제거 → '강동본점' → '강동', '동작직영점' → '동작'
        stripped = last[:m.start()]
        if stripped:
            v = " ".join(parts[:-1] + [stripped])
            if v not in out:
                out.append(v)
    else:
        # 일반 ~점 → 끝 한 글자만 제거 (강남역점 → 강남역)
        stripped = last[:-1]
        if stripped:
            v = " ".join(parts[:-1] + [stripped])
            if v not in out:
                out.append(v)
    # 마지막 토큰 통째 제거 — fallback
    without_last = " ".join(parts[:-1])
    if without_last and without_last not in out:
        out.append(without_last)
    return out


def _search_first_place_id(query: str, client: httpx.Client) -> str | None:
    """m.map.naver.com 검색 페이지 → SSR 본문에서 첫 /place/{id} 추출."""
    try:
        r = client.get(_SEARCH_URL, params={"query": query})
        if r.status_code != 200:
            return None
        m = _PLACE_ID_RX.search(r.text)
        return m.group(1) if m else None
    except Exception:
        return None


def _place_coordinate(place_id: str, client: httpx.Client) -> tuple[float, float] | None:
    """summary API → (lat, lng). 실패 시 None."""
    try:
        r = client.get(_SUMMARY_URL.format(place_id), headers=_HEADERS_SUMMARY)
        if r.status_code != 200:
            return None
        j = r.json()
        coord = (((j.get("data") or {}).get("placeDetail")) or {}).get("coordinate")
        if not coord:
            return None
        return float(coord["latitude"]), float(coord["longitude"])
    except Exception:
        return None


def match(
    name: str,
    address: str,
    target_lat: float,
    target_lng: float,
    *,
    max_distance_m: float = 300.0,
    sleep_between: float = 0.0,
) -> NaverMatch | None:
    """가게이름·주소·우리 좌표로 네이버 place 매칭.

    name: 가게이름 (분점 접미사 자동 제거 변형 시도)
    address: 도로명 주소 (앞 3토큰 = 시/구/동 정도만 검색에 사용)
    target_lat/lng: 우리 카카오 매칭 좌표 (좌표 검증 기준)
    max_distance_m: 네이버 좌표와 우리 좌표 차이 허용 최대값
    sleep_between: 변형마다 sleep — 봇차단 회피용
    """
    name = (name or "").strip()
    address = (address or "").strip()
    addr_short = " ".join(address.split()[:3])

    queries: list[str] = []
    seen: set[str] = set()
    for n in _name_variants(name):
        for q in (f"{n} {addr_short}" if addr_short else "", n):
            q = q.strip()
            if q and q not in seen:
                seen.add(q)
                queries.append(q)

    with httpx.Client(timeout=10.0, headers=_HEADERS_SEARCH, follow_redirects=True) as client:
        for i, q in enumerate(queries):
            if i > 0 and sleep_between > 0:
                time.sleep(sleep_between)
            pid = _search_first_place_id(q, client)
            if not pid:
                continue
            coord = _place_coordinate(pid, client)
            if not coord:
                # 좌표 못 받으면 일단 ID 만 채택 — 매칭 신뢰도는 낮음
                continue
            lat, lng = coord
            dist = _haversine_m(target_lat, target_lng, lat, lng)
            if dist <= max_distance_m:
                return NaverMatch(place_id=pid, lat=lat, lng=lng, distance_m=dist, matched_query=q)
    return None


def naver_place_url(place_id: str) -> str:
    """식당 상세 페이지 link 용 — 모바일 plate 페이지."""
    return f"https://m.place.naver.com/restaurant/{place_id}/home"
