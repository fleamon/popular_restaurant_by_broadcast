"""Supabase 클라이언트 팩토리. 함수형 — 전역 상태 최소화."""
from __future__ import annotations

import time
from functools import lru_cache
from typing import Any, TypeVar

import httpx
from supabase import Client, create_client

from ..settings import get_settings


def _force_http1(client: Client) -> Client:
    """supabase 내부 postgrest httpx 세션을 HTTP/1.1 전용으로 교체.

    postgrest-py 는 httpx 를 http2=True 로 만든다. 그런데 캐시된 클라이언트 1개를
    gunicorn/uvicorn threadpool 의 여러 스레드가 동시에 쓰면 HTTP/2 스트림 상태머신이
    깨져 `LocalProtocolError: Invalid input SEND_HEADERS` / httpcore `KeyError` 가 난다.
    HTTP/1.1 은 요청마다 풀에서 별도 커넥션을 쓰므로 동시성에 안전하다.

    내부 구조 의존이라 방어적으로 — 실패하면 원본(HTTP/2) 그대로 두고 재시도 로직에 맡긴다.
    """
    try:
        pg = getattr(client, "postgrest", None)
        sess = getattr(pg, "session", None)
        if isinstance(sess, httpx.Client):
            new = httpx.Client(
                base_url=sess.base_url,
                headers=sess.headers,
                timeout=sess.timeout,
                http2=False,
            )
            try:
                sess.close()
            except Exception:
                pass
            pg.session = new
    except Exception:
        pass
    return client


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """익명 키 — 읽기 전용 API 라우트에서 사용."""
    s = get_settings()
    return _force_http1(create_client(s["supabase_url"], s["supabase_anon_key"]))


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """service_role 키 — admin 라우트·서버 측 쓰기에서 RLS bypass."""
    s = get_settings()
    return _force_http1(create_client(s["supabase_url"], s["supabase_service_role_key"]))


def reset_clients() -> None:
    """캐시된 클라이언트를 폐기 — 다음 호출 시 새 HTTP 연결 풀로 재생성."""
    get_anon_client.cache_clear()
    get_service_client.cache_clear()


# Supabase 내부 httpx 가 던지는 전송 예외들 — reset 후 재시도하면 대개 복구.
# HTTP/2 를 끄면 대부분 사라지지만, 잔존 케이스(LocalProtocolError 등) 안전망으로 포함.
_TRANSIENT_EXC = (
    httpx.ProtocolError,        # Remote/LocalProtocolError 공통 베이스 (HTTP/2 스트림 상태 깨짐 포함)
    httpx.ConnectError,
    httpx.ReadError,
    httpx.WriteError,
    httpx.PoolTimeout,
    httpx.ReadTimeout,
)


T = TypeVar("T")


def fetch_all(builder: Any, page_size: int = 1000) -> list[dict]:
    """Postgrest 1회 응답 1000행 한도를 페이지 단위 누적으로 우회.
    .order() 가 적용된 빌더에 그대로 .range() 만 추가해 호출 — 정렬 유지됨.
    """
    out: list[dict] = []
    start = 0
    while True:
        chunk = exec_with_retry(builder.range(start, start + page_size - 1)).data or []
        out.extend(chunk)
        if len(chunk) < page_size:
            break
        start += page_size
    return out


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
