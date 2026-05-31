"""콘솔/CI 에서 YouTube 저장 데이터 동기화 — /admin 의 'YouTube 동기화' 와 동일 로직.

저장한 영상의 제목·썸네일을 공식 API 로 갱신하고, 삭제·비공개된 영상의 appearance
(및 고아 식당)를 정리한다. YouTube API 약관(주기적 갱신·동기 삭제) 준수 목적.
.github/workflows/youtube-sync.yml 이 25일 주기로 이 진입점을 호출한다.

사용 예:
    python -m data.sync_youtube           # 전체 동기화 후 요약 출력
    python -m data.sync_youtube --quiet   # 요약만
"""
from __future__ import annotations

import argparse

from app.api.services.youtube_sync import sync_stream


def main() -> None:
    ap = argparse.ArgumentParser(description="YouTube 저장 데이터 동기화 (갱신/삭제)")
    ap.add_argument("-q", "--quiet", action="store_true", help="세부 이벤트 숨기고 요약만 출력")
    args = ap.parse_args()

    summary: dict = {}
    for ev in sync_stream():
        stage = ev.get("stage")
        if stage == "done":
            summary = ev.get("summary", {})
        elif stage == "error":
            raise SystemExit(f"[error] {ev['message']}")
        elif not args.quiet and stage in ("updated", "removed", "removed_restaurant"):
            print(ev, flush=True)
        elif stage == "start":
            print(f"[i] 동기화 대상 영상 appearance {ev['total']}건", flush=True)

    print(
        "[done] "
        f"검사 {summary.get('checked', 0)} · "
        f"갱신 {summary.get('updated', 0)} · "
        f"삭제영상 {summary.get('dead_videos', 0)} "
        f"(appearance {summary.get('removed_appearances', 0)}, "
        f"식당 {summary.get('removed_restaurants', 0)})",
        flush=True,
    )


if __name__ == "__main__":
    main()
