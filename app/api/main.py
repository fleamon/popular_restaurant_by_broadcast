"""백안맛지도 FastAPI 엔트리.

실행: `uvicorn app.api.main:app --reload` (repo 루트) 또는 `uvicorn main:app` (app/api 디렉터리)
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import admin, channels, restaurants, votes

app = FastAPI(title="백안맛지도 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router)
app.include_router(channels.router)
app.include_router(votes.router)
app.include_router(admin.router)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
