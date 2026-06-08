"""OpenAI Chat Completions 로 YouTube 영상 메타에서 음식점 정보 추출.

응답은 strict JSON. SDK 의 response_format={"type":"json_object"} 사용.
모델 기본값: gpt-4o-mini (env OPENAI_MODEL 로 변경 가능).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from openai import OpenAI

from ..settings import get_settings


@lru_cache(maxsize=1)
def _get_client(api_key: str) -> OpenAI:
    """OpenAI 클라이언트 1개 재사용 — 내부 httpx 커넥션 풀을 매 호출마다 새로 만들지 않도록.
    (영상마다 새 OpenAI() 를 만들면 닫히지 않은 httpx 풀이 누적돼 메모리 누수 → OOM.)
    """
    return OpenAI(api_key=api_key)


@dataclass(frozen=True)
class ExtractedRestaurant:
    name: str
    address: str | None
    naver_url: str | None
    kakao_url: str | None


_SYSTEM = """너는 한국 유튜브 맛집 영상의 제목·설명에서 소개된 음식점 정보를 정확히 뽑아내는 도우미다.

반드시 다음 JSON 스키마로만 응답한다 (markdown·주석·추가 텍스트 금지):

{
  "restaurants": [
    {
      "name": "가게의 정확한 이름",
      "address": "전체 주소 (도로명 또는 지번). 명시 없으면 null",
      "naver_url": "본문에 네이버 지도 링크가 있으면 그 URL (https://naver.me/... 또는 map.naver.com/...). 없으면 null",
      "kakao_url": "본문에 카카오 지도 링크가 있으면 그 URL. 없으면 null"
    }
  ]
}

규칙:
- 영상에서 실제로 방문·소개한 음식점만 추출한다. 단순 언급, 광고, 협찬 표기만 있는 곳은 제외.
- 한 영상에 여러 가게가 등장하면 모두 배열에 넣는다 (순서 유지).
- 가게 이름은 본문에 적힌 그대로(공식 상호). 가게 외 다른 장소(공원, 호텔 등)는 제외.
- 주소가 도로명·지번 형태로 명시되지 않았으면 address=null (추측 금지).
- 음식점이 하나도 없으면 restaurants=[].
"""


def extract(title: str, description: str) -> list[ExtractedRestaurant]:
    cfg = get_settings()
    api_key = cfg["openai_api_key"]
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 가 설정되지 않음 (config/secrets.json → openai.api_key)")
    client = _get_client(api_key)
    model = cfg["openai_model"] or "gpt-4o-mini"

    user = f"제목: {title}\n\n설명:\n{description}"
    resp = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=2000,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    raw = data.get("restaurants") or []
    out: list[ExtractedRestaurant] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        name = (r.get("name") or "").strip()
        if not name:
            continue
        out.append(ExtractedRestaurant(
            name=name,
            address=(r.get("address") or None) or None,
            naver_url=(r.get("naver_url") or None) or None,
            kakao_url=(r.get("kakao_url") or None) or None,
        ))
    return out
