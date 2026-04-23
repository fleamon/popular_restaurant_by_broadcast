"""백안맛지도 데이터 수집 엔트리포인트.

사용 예:
    python data/main.py --dry-run          # 네트워크 호출은 하되 DB에는 쓰지 않음
    python data/main.py --commit           # 실제 Supabase 에 upsert
    python data/main.py --channels ./data/channels.json

channels.json 형식:
    [{ "name": "...", "channel_type": "tv|youtube|blog|other",
       "platform": "SBS", "wiki_url": "https://..." }, ...]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipelines import extract, load, transform
from utils.logger import get_logger

log = get_logger("ingest")
DEFAULT_CHANNELS = Path(__file__).resolve().parent / "channels.json"


def load_channels(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def run_one(channel: dict, *, commit: bool) -> None:
    log.info("▶ %s (%s)", channel["name"], channel.get("channel_type"))

    try:
        rows = extract.extract_for_channel(channel)
    except Exception as e:
        log.warning("extract 실패 %s: %s", channel["name"], e)
        return
    log.info("  · 추출 %d 건", len(rows))

    payloads = [p for p in (transform.normalize(r) for r in rows) if p]
    log.info("  · 정규화 %d 건", len(payloads))

    if not commit:
        return

    channel_id = load.upsert_channel(channel)
    for p in payloads:
        try:
            rid = load.upsert_restaurant(p)
            load.add_appearance(rid, channel_id, summary=p.get("current_name"))
        except Exception as e:
            log.warning("load 실패 %s: %s", p.get("current_name"), e)
    log.info("  ✔ 적재 완료")


def main() -> int:
    ap = argparse.ArgumentParser(description="백안맛지도 데이터 수집")
    ap.add_argument("--channels", type=Path, default=DEFAULT_CHANNELS)
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--dry-run", dest="commit", action="store_false", default=False)
    group.add_argument("--commit",  dest="commit", action="store_true")
    args = ap.parse_args()

    channels = load_channels(args.channels)
    log.info("채널 %d 개 (commit=%s)", len(channels), args.commit)
    for ch in channels:
        run_one(ch, commit=args.commit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
