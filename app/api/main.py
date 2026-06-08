"""백안맛지도 FastAPI 엔트리.

실행: `uvicorn app.api.main:app --reload` (repo 루트) 또는 `uvicorn main:app` (app/api 디렉터리)
"""
from __future__ import annotations

import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from .routers import admin, auth, bookmarks, channels, requests as requests_router, restaurants, users, visits, votes

# redoc_url=None 으로 내장 ReDoc 라우트를 끄고, 아래에서 안정 버전 CDN 으로 직접 등록.
# FastAPI 기본값이 redoc@next 를 가리키는데 해당 태그 번들 경로가 깨져서 화면이 빈다.
app = FastAPI(title="백안맛지도 API", version="0.1.0", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        # Vercel 운영(고정) 도메인
        "https://popular-restaurant-by-broadcast.vercel.app",
        # 자체 도메인 — 운영 시 활성화
        "https://www.white_eyes_matmap.com",
        "https://white_eyes_matmap.com",
        # 맛맵.com (Punycode: xn--0z2byb)
        "https://www.xn--0z2byb.com",
        "https://xn--0z2byb.com",
    ],
    # Vercel Preview deploy + 로컬 dev(포트 가변) 허용 — regex 매칭.
    # (`allow_origins` 의 "*.vercel.app" 는 글자그대로 비교돼 안 됨. localhost 는 3000 이 점유되면
    #  Next 가 3001+ 로 떠서 포트가 바뀌므로 포트 무관하게 허용.)
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router)
app.include_router(channels.router)
app.include_router(votes.router)
app.include_router(bookmarks.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(requests_router.router)
app.include_router(visits.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/redoc", include_in_schema=False)
def redoc() -> HTMLResponse:
    return get_redoc_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
    )


# GET + HEAD 둘 다 허용 — UptimeRobot 무료 플랜은 HEAD 요청만 보내므로.
# (FastAPI 의 @app.get 은 순수 Starlette 과 달리 HEAD 를 자동 추가하지 않아 405 가 났음.)
@app.api_route("/healthz", methods=["GET", "HEAD"])
def healthz() -> dict:
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────
# Global exception handler — 500 응답에도 CORS 헤더가 붙도록.
# FastAPI 의 CORSMiddleware 는 정상 응답만 wrap 하므로, unhandled exception 시
# 브라우저가 "No 'Access-Control-Allow-Origin' header" 로 오해함.
# 여기서 허용 origin 인지 검사 후 헤더 echo.
# ─────────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "https://popular-restaurant-by-broadcast.vercel.app",
    "https://www.white_eyes_matmap.com",
    "https://white_eyes_matmap.com",
    "https://www.xn--0z2byb.com",
    "https://xn--0z2byb.com",
}
_VERCEL_PREVIEW_RE = re.compile(r"^(https://.*\.vercel\.app|http://localhost:\d+)$")


def _cors_headers_for(origin: str | None) -> dict[str, str]:
    if not origin:
        return {}
    if origin in _ALLOWED_ORIGINS or _VERCEL_PREVIEW_RE.match(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": f"internal server error: {type(exc).__name__}"},
        headers=_cors_headers_for(request.headers.get("origin")),
    )
