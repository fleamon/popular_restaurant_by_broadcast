"""공용 유틸리티 — 여러 라우터/서비스가 공유."""
from __future__ import annotations

import re


def norm_channel(name: str) -> str:
    """채널명 정규화 — 모든 공백 제거. admin 의 charge_channel 비교/조회 시 사용.

    DB 표기('배달의민족') 와 사용자 입력('배달의 민족') 의 공백 차이를 흡수하기 위해
    프론트·백엔드 모두 같은 정규화로 비교한다.
    """
    return re.sub(r"\s+", "", (name or "").strip())
