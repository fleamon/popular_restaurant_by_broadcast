"""카카오 Local REST API — 키워드 검색으로 가게 정보 + 좌표 + 시/구/동 추출.

응답 예시 (documents[0]):
  {
    "place_name": "서린낙지",
    "address_name": "서울 종로구 종로1가 24",
    "road_address_name": "서울 종로구 종로 19 르메이에르종로타운1 2층",
    "place_url": "http://place.map.kakao.com/7937472",
    "id": "7937472",
    "x": "126.9801286",  # lng
    "y": "37.5709094",   # lat
    "category_name": "음식점 > 한식 > 낙지요리"
  }
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from ..settings import get_settings

_TIMEOUT = 10.0

# 카카오 region_1depth_name 의 짧은 이름 → 시도 전체 명칭 매핑.
# (lib/geocode.ts 와 동일 — 검색 페이지의 sido 필터와 정합)
_SIDO_MAP: dict[str, str] = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시",
    "광주": "광주광역시", "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시",
    "경기": "경기도", "강원": "강원특별자치도", "강원도": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도", "전라북도": "전북특별자치도",
    "전남": "전라남도", "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
}


@dataclass(frozen=True)
class KakaoPlace:
    place_id: str
    name: str
    address: str            # 지번
    road_address: str | None
    lat: float
    lng: float
    sido: str | None
    sigungu: str | None
    dong: str | None
    kakao_map_url: str | None
    category: str | None    # "음식점 > 한식 > ..." 마지막 토큰만 추출해 카테고리로 활용 가능


def _api_key() -> str:
    key = get_settings()["kakao_rest_api_key"]
    if not key:
        raise RuntimeError("KAKAO_REST_API_KEY 가 설정되지 않음 (config/secrets.json → kakao.rest_api_key)")
    return key


def _split_address(addr: str) -> tuple[str | None, str | None, str | None]:
    """'서울 종로구 종로1가' → ('서울특별시', '종로구', '종로1가') 같이 분리."""
    parts = (addr or "").split()
    sido_short = parts[0] if len(parts) > 0 else None
    sigungu = parts[1] if len(parts) > 1 else None
    dong = parts[2] if len(parts) > 2 else None
    sido = _SIDO_MAP.get(sido_short or "", sido_short) if sido_short else None
    return sido, sigungu, dong


def _kakao_search(query: str, *, food_only: bool = True) -> list[dict]:
    headers = {"Authorization": f"KakaoAK {_api_key()}"}
    params: dict = {"query": query, "size": 5}
    if food_only:
        params["category_group_code"] = "FD6,CE7"
    try:
        with httpx.Client(timeout=_TIMEOUT) as c:
            r = c.get("https://dapi.kakao.com/v2/local/search/keyword.json", headers=headers, params=params)
            r.raise_for_status()
            return (r.json() or {}).get("documents") or []
    except Exception:
        return []


# 명확한 분점 표기 — 통째 제거할 패턴 (alternation 순서 무관, 길이로 매칭).
_BRANCH_SUFFIX_RX = re.compile(r"(\d+호점|본점|분점|지점)$")


def _name_variants(name: str) -> list[str]:
    """가게명 변형: 원본 + 분점 접미사 제거판 + 마지막 토큰 통째 제거판.

    예:
      '다람 강동본점'   → ['다람 강동본점', '다람 강동', '다람']
      '스타벅스 강남역점' → ['스타벅스 강남역점', '스타벅스 강남역', '스타벅스']
      '커피빈 1호점'    → ['커피빈 1호점', '커피빈']
      '명동교자'        → ['명동교자']  (1토큰이라 변형 없음)
    """
    name = (name or "").strip()
    if not name:
        return []
    out: list[str] = [name]
    parts = name.split()
    if len(parts) < 2 or not parts[-1].endswith("점"):
        return out
    last = parts[-1]
    # (1) '본점/분점/지점/N호점' 같은 명확한 분점 표기는 통째 제거 → '강동본점' → '강동'
    m = _BRANCH_SUFFIX_RX.search(last)
    if m:
        stripped = last[:m.start()]
        if stripped:
            v = " ".join(parts[:-1] + [stripped])
            if v not in out:
                out.append(v)
    else:
        # (2) 그 외 '점' 으로 끝나는 단어는 끝의 '점' 한 글자만 제거 → '강남역점' → '강남역'
        stripped = last[:-1]
        if stripped:
            v = " ".join(parts[:-1] + [stripped])
            if v not in out:
                out.append(v)
    # (3) 마지막 토큰 통째 제거 — 어느 경우든 안전 fallback ('다람 강동본점' → '다람')
    without_last = " ".join(parts[:-1])
    if without_last and without_last not in out:
        out.append(without_last)
    return out


def _to_place(d: dict) -> KakaoPlace:
    sido, sigungu, dong = _split_address(d.get("address_name") or "")
    return KakaoPlace(
        place_id=str(d.get("id") or ""),
        name=d.get("place_name") or "",
        address=d.get("address_name") or "",
        road_address=d.get("road_address_name") or None,
        lat=float(d.get("y") or 0),
        lng=float(d.get("x") or 0),
        sido=sido,
        sigungu=sigungu,
        dong=dong,
        kakao_map_url=d.get("place_url") or None,
        category=d.get("category_name") or None,
    )


def search(query: str, *, name_hint: str | None = None, address_hint: str | None = None) -> KakaoPlace | None:
    """LLM 이 뽑은 이름/주소로 카카오 매칭.

    가게명에서 분점 접미사(본점/분점/지점/N호점/역점/점) 를 점진적으로 떼면서
    각 단계에서 [이름+시구동], [이름 단독] 을 음식점 우선 → 전체 카테고리로 시도.
    하나라도 매칭되면 즉시 채택. 모두 실패하면 주소 단독으로 마지막 시도.
    """
    name = (name_hint or "").strip()
    address = (address_hint or "").strip()
    short_addr = " ".join(address.split()[:3]) if address else ""

    candidates: list[str] = []
    seen: set[str] = set()

    def add(c: str) -> None:
        c = c.strip()
        if c and c not in seen:
            seen.add(c)
            candidates.append(c)

    # 1) 사용자가 직접 넘긴 원본 쿼리
    if query.strip():
        add(query)

    # 2) 이름 변형 × (시구동 동반 + 이름 단독)
    for n in _name_variants(name):
        if short_addr:
            add(f"{n} {short_addr}")
        add(n)

    # 3) 마지막 수단 — 주소 단독
    if address:
        add(address)

    for q in candidates:
        docs = _kakao_search(q, food_only=True)
        if docs:
            return _to_place(docs[0])
        docs = _kakao_search(q, food_only=False)
        if docs:
            return _to_place(docs[0])
    return None


def cuisine_from_category(category: str | None) -> str | None:
    """'음식점 > 한식 > 낙지요리' → '한식'. 매핑되는 표준 값만 채택."""
    if not category:
        return None
    parts = [p.strip() for p in category.split(">")]
    valid = {"한식", "양식", "일식", "중식", "분식", "카페", "베이커리", "디저트", "아시안", "패스트푸드"}
    for p in parts:
        if p in valid:
            return p
    return None
