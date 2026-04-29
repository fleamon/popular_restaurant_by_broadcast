"""시크릿 로더: 환경변수 우선, 없으면 config/secrets.json fallback.

함수형으로 작성 — 호출 시마다 순수하게 dict를 반환한다.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = REPO_ROOT / "config" / "secrets.json"


def _load_file_secrets() -> dict[str, Any]:
    if not SECRETS_PATH.exists():
        return {}
    return json.loads(SECRETS_PATH.read_text(encoding="utf-8"))


def _env(key: str) -> str | None:
    value = os.environ.get(key)
    return value if value else None


@lru_cache(maxsize=1)
def get_settings() -> dict[str, Any]:
    """우선순위: 환경변수 > config/secrets.json. 캐시 1회."""
    file_secrets = _load_file_secrets()

    def pick(env_key: str, *path: str) -> str:
        cursor: Any = file_secrets
        for p in path:
            cursor = (cursor or {}).get(p)
        return _env(env_key) or (cursor or "")

    return {
        "supabase_url":              pick("SUPABASE_URL",              "supabase", "url"),
        "supabase_anon_key":         pick("SUPABASE_ANON_KEY",         "supabase", "anon_key"),
        "supabase_service_role_key": pick("SUPABASE_SERVICE_ROLE_KEY", "supabase", "service_role_key"),
        "admin_email":               pick("ADMIN_EMAIL",               "admin", "email"),
        "admin_signup_id":           pick("ADMIN_SIGNUP_ID",           "admin", "signup_id"),
        "admin_signup_password":     pick("ADMIN_SIGNUP_PASSWORD",     "admin", "signup_password"),
        "naver_client_id":           pick("NAVER_CLIENT_ID",           "naver", "client_id"),
        "naver_client_secret":       pick("NAVER_CLIENT_SECRET",       "naver", "client_secret"),
        "kakao_rest_api_key":        pick("KAKAO_REST_API_KEY",        "kakao", "rest_api_key"),
        "kakao_js_key":              pick("KAKAO_JS_KEY",              "kakao", "javascript_key"),
    }
