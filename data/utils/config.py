"""데이터 수집 스크립트용 시크릿 로더 — app/api/settings.py 와 동일 규칙.

환경변수 > config/secrets.json 우선순위.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = REPO_ROOT / "config" / "secrets.json"


def _file() -> dict[str, Any]:
    return json.loads(SECRETS_PATH.read_text(encoding="utf-8")) if SECRETS_PATH.exists() else {}


def _pick(secrets: dict[str, Any], env_key: str, *path: str) -> str:
    if os.environ.get(env_key):
        return os.environ[env_key]
    cursor: Any = secrets
    for p in path:
        cursor = (cursor or {}).get(p)
    return cursor or ""


@lru_cache(maxsize=1)
def get_config() -> dict[str, str]:
    s = _file()
    return {
        "supabase_url":              _pick(s, "SUPABASE_URL", "supabase", "url"),
        "supabase_service_role_key": _pick(s, "SUPABASE_SERVICE_ROLE_KEY", "supabase", "service_role_key"),
        "naver_client_id":           _pick(s, "NAVER_CLIENT_ID", "naver", "client_id"),
        "naver_client_secret":       _pick(s, "NAVER_CLIENT_SECRET", "naver", "client_secret"),
        "kakao_rest_api_key":        _pick(s, "KAKAO_REST_API_KEY", "kakao", "rest_api_key"),
    }
