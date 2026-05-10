"""채널 → YouTube 채널 페이지 → og:image 추출 → channels.thumbnail_url + wiki_url 일괄 갱신.

매핑(NAME_TO_YT)에 새 채널을 추가한 뒤 한 번만 실행하면 됩니다.

    python -m data.seed_channel_thumbnails

config/secrets.json 의 supabase.url + supabase.service_role_key 를 사용.
"""
from __future__ import annotations

import re
import sys

import requests
from supabase import create_client

from .utils.config import get_config
from .utils.logger import get_logger

log = get_logger("seed_channels")

# 채널명(공백 제거 기준) → YouTube 채널 URL.
# 신규 채널이 늘어나면 여기에 추가하면 됨.
NAME_TO_YT: dict[str, str] = {
    "먹을텐데": "https://www.youtube.com/@sungsikyung",
    "비밀이야": "https://www.youtube.com/@bimirya",
    "히밥":     "https://www.youtube.com/@heebab",
}

_OG_IMAGE_RX = re.compile(
    r'<meta[^>]+(?:property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']'
    r'|content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\'])',
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip())


def fetch_og_image(url: str) -> str | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; baekanmatjido/1.0)",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
    }
    r = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
    r.raise_for_status()
    m = _OG_IMAGE_RX.search(r.text)
    if not m:
        return None
    return m.group(1) or m.group(2)


def main() -> int:
    cfg = get_config()
    if not cfg["supabase_url"] or not cfg["supabase_service_role_key"]:
        log.error("config/secrets.json 의 supabase.url / supabase.service_role_key 가 비어있습니다.")
        return 1

    sb = create_client(cfg["supabase_url"], cfg["supabase_service_role_key"])
    rows = sb.table("channels").select("id, name, wiki_url, thumbnail_url").execute().data or []
    by_norm = {_norm(r["name"]): r for r in rows}

    ok, miss, fail = 0, 0, 0
    for name, yt_url in NAME_TO_YT.items():
        ch = by_norm.get(_norm(name))
        if not ch:
            log.warning("[skip] DB 에 채널이 없음: %s", name)
            miss += 1
            continue
        try:
            img = fetch_og_image(yt_url)
        except Exception as e:
            log.error("[fail] %s — fetch error: %s", name, e)
            fail += 1
            continue
        if not img:
            log.error("[fail] %s — og:image 미발견", name)
            fail += 1
            continue

        sb.table("channels").update({
            "wiki_url": yt_url,
            "thumbnail_url": img,
            "channel_type": "youtube",
        }).eq("id", ch["id"]).execute()
        log.info("[ok]  %s — %s", name, img)
        ok += 1

    log.info("done — ok=%d miss=%d fail=%d", ok, miss, fail)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
