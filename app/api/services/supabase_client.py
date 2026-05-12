"""Supabase 클라이언트 팩토리. 함수형 — 전역 상태 최소화."""
from __future__ import annotations

import time
from functools import lru_cache
from typing import Any, TypeVar

import httpx
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


def reset_clients() -> None:
    """캐시된 클라이언트를 폐기 — 다음 호출 시 새 HTTP 연결 풀로 재생성."""
    get_anon_client.cache_clear()
    get_service_client.cache_clear()


# Supabase 내부 httpx 가 HTTP/2 idle disconnection 으로 가끔 던지는 전송 예외들.
_TRANSIENT_EXC = (
    httpx.RemoteProtocolError,
    httpx.ConnectError,
    httpx.ReadError,
    httpx.WriteError,
    httpx.PoolTimeout,
    httpx.ReadTimeout,
)


T = TypeVar("T")


def exec_with_retry(builder: Any, retries: int = 3) -> Any:
    """Supabase 빌더의 .execute() 를 transient 전송 오류에 대해 자동 재시도.

    HTTP/2 'Server disconnected' 같이 서버 측이 idle 연결을 끊은 경우 클라이언트가
    아직 모르고 그 connection 으로 요청 → RemoteProtocolError. 클라이언트 캐시를
    비우고 재시도하면 새 연결 풀로 정상 동작.
    """
    delay = 0.3
    last_exc: Exception | None = None
    for _ in range(retries):
        try:
            return builder.execute()
        except _TRANSIENT_EXC as e:
            last_exc = e
            reset_clients()
            time.sleep(delay)
            delay *= 2
    if last_exc:
        raise last_exc
    return None
