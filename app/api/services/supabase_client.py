"""Supabase 클라이언트 팩토리. 함수형 — 전역 상태 최소화."""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from ..settings import get_settings


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """익명 키 — 읽기 전용 API 라우트에서 사용."""
    s = get_settings()
    return create_client(s["supabase_url"], s["supabase_anon_key"])


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """service_role 키 — admin 라우트·서버 측 쓰기에서 RLS bypass."""
    s = get_settings()
    return create_client(s["supabase_url"], s["supabase_service_role_key"])
