"""백안맛지도 FastAPI 엔트리.

실행: `uvicorn app.api.main:app --reload` (repo 루트) 또는 `uvicorn main:app` (app/api 디렉터리)
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse, RedirectResponse

from .routers import admin, auth, channels, requests as requests_router, restaurants, users, votes

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
        "https://www.xn--hq1bm9i1sp.com",
        "https://xn--hq1bm9i1sp.com",
    ],
    # Vercel Preview deploy 도 허용 — regex 매칭. (`allow_origins` 의 "*.vercel.app" 는 글자그대로 비교돼 안 됨)
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router)
app.include_router(channels.router)
app.include_router(votes.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(requests_router.router)


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


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
