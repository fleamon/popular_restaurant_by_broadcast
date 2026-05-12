"""콘솔에서 채널 자동 수집 — /admin 의 '채널 자동 수집' 과 동일 파이프라인.

초기 데이터 일괄 적재 용도. 브라우저 부담 없이 영상 수백~수천 개 처리 가능.

사용 예:
    python -m data.ingest_channels @sungsikyung @bimirya @heebab --max-videos 200
    python -m data.ingest_channels --file handles.txt --max-videos 1000
    cat handles.txt | python -m data.ingest_channels --stdin --max-videos 1000

옵션:
    --max-videos N    채널당 최신 영상 N 개 처리 (1~1000, 기본 100)
    --user-seq N      created_by 로 기록할 user.sequence. 미지정 시 superadmin 자동 탐지
    --file PATH       핸들 목록 파일 (한 줄에 하나)
    --stdin           표준입력에서 핸들 읽기
    -q, --quiet       세부 이벤트 로그 숨기고 요약만 출력
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.api.services.ingest_channel import ingest_channel_stream
from app.api.services.supabase_client import exec_with_retry, get_service_client


# ANSI 색상 — 터미널 가독성
class C:
    RESET = "\033[0m"
    DIM = "\033[2m"
    BOLD = "\033[1m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    MAGENTA = "\033[35m"


def _detect_superadmin_seq() -> int:
    """첫번째 superadmin 의 sequence 자동 탐지 — created_by 기본값."""
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("users").select("sequence, email").eq("role", "superadmin").order("sequence").limit(1)
    ).data or []
    if not rows:
        raise SystemExit("superadmin 계정이 없습니다. --user-seq 로 직접 지정하세요.")
    print(f"{C.DIM}[i] created_by = sequence {rows[0]['sequence']} ({rows[0]['email']}){C.RESET}", flush=True)
    return rows[0]["sequence"]


def _print_event(ev: dict, quiet: bool) -> None:
    stage = ev.get("stage", "?")
    if stage == "channel":
        ch = ev.get("channel", {})
        print(f"  {C.BOLD}{C.BLUE}📺 채널{C.RESET} {ch.get('name')} (id={ch.get('id')})", flush=True)
    elif stage == "videos_fetched":
        print(f"  {C.CYAN}🎬 영상 {ev.get('count')} 개 로드{C.RESET}", flush=True)
    elif stage == "video_start":
        if quiet:
            return
        title = (ev.get("title") or "").replace("\n", " ")[:70]
        print(f"  {C.DIM}[{ev.get('i')}/{ev.get('n')}] {title}{C.RESET}", flush=True)
    elif stage == "video_extracted":
        if quiet:
            return
        found = ev.get("found") or []
        shown = ", ".join(found) if found else "(없음)"
        print(f"    {C.BLUE}↳ 추출{C.RESET} {shown}", flush=True)
    elif stage == "restaurant_saved":
        r = ev.get("restaurant", {})
        print(f"    {C.GREEN}✅ {r.get('name')}{C.RESET} · {C.DIM}{r.get('address')}{C.RESET}", flush=True)
    elif stage == "restaurant_skipped":
        print(f"    {C.YELLOW}⏭ {ev.get('name')} — {ev.get('reason')}{C.RESET}", flush=True)
    elif stage == "video_done":
        if quiet:
            return
        if ev.get("skip"):
            print(f"    {C.DIM}─ skip: {ev.get('skip')}{C.RESET}", flush=True)
    elif stage == "done":
        s = ev.get("summary", {})
        print(f"  {C.BOLD}{C.GREEN}🏁 완료{C.RESET} — 영상 {s.get('videos')}, 저장 {s.get('saved')}, 스킵 {s.get('skipped')}", flush=True)
    elif stage == "error":
        print(f"  {C.BOLD}{C.RED}❌ {ev.get('message')}{C.RESET}", flush=True)


def _collect_handles(args: argparse.Namespace) -> list[str]:
    raw: list[str] = list(args.handles or [])
    if args.file:
        raw.extend(Path(args.file).read_text(encoding="utf-8").splitlines())
    if args.stdin:
        raw.extend(sys.stdin.read().splitlines())
    # 줄바꿈/쉼표 분할, 공백 제거, dedupe
    out: list[str] = []
    seen: set[str] = set()
    for line in raw:
        for h in line.replace(",", " ").split():
            h = h.strip()
            if h and h not in seen:
                seen.add(h)
                out.append(h)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="data.ingest_channels",
                                     description="콘솔 채널 자동 수집 (YouTube → OpenAI → Kakao → Supabase)")
    parser.add_argument("handles", nargs="*", help="채널 핸들 또는 URL (예: @sungsikyung https://www.youtube.com/@bimirya)")
    parser.add_argument("--max-videos", type=int, default=100, help="채널당 최신 영상 수 (1~1000, 기본 100)")
    parser.add_argument("--user-seq", type=int, default=None, help="created_by 로 기록할 user.sequence (기본: 첫번째 superadmin)")
    parser.add_argument("--file", type=str, default=None, help="핸들 목록 파일 (한 줄에 하나)")
    parser.add_argument("--stdin", action="store_true", help="표준입력에서 핸들 읽기")
    parser.add_argument("-q", "--quiet", action="store_true", help="세부 이벤트 숨기고 요약만 출력")
    args = parser.parse_args(argv)

    if not (1 <= args.max_videos <= 1000):
        parser.error("--max-videos 는 1~1000 사이")

    handles = _collect_handles(args)
    if not handles:
        parser.error("핸들이 비어있습니다. 인자/--file/--stdin 중 하나로 제공하세요.")

    user_seq = args.user_seq if args.user_seq is not None else _detect_superadmin_seq()

    print(f"{C.BOLD}채널 {len(handles)} 개, 채널당 영상 {args.max_videos} 개{C.RESET}\n", flush=True)

    total_saved = 0
    total_skipped = 0
    total_videos = 0
    failed_channels: list[str] = []

    for i, h in enumerate(handles, 1):
        print(f"\n{C.BOLD}{C.MAGENTA}━━━ [{i}/{len(handles)}] {h} ━━━{C.RESET}", flush=True)
        try:
            for ev in ingest_channel_stream(h, args.max_videos, user_seq):
                _print_event(ev, args.quiet)
                if ev.get("stage") == "restaurant_saved":
                    total_saved += 1
                elif ev.get("stage") == "restaurant_skipped":
                    total_skipped += 1
                elif ev.get("stage") == "done":
                    total_videos += (ev.get("summary") or {}).get("videos") or 0
                elif ev.get("stage") == "error":
                    failed_channels.append(h)
        except Exception as e:
            print(f"  {C.BOLD}{C.RED}❌ 채널 처리 실패: {e}{C.RESET}", flush=True)
            failed_channels.append(h)

    print(f"\n{C.BOLD}━━━ 전체 완료 ━━━{C.RESET}", flush=True)
    print(f"  채널: {C.GREEN}{len(handles) - len(failed_channels)}{C.RESET} 성공 / {C.RED}{len(failed_channels)}{C.RESET} 실패", flush=True)
    print(f"  영상: {total_videos}  ·  저장: {C.GREEN}{total_saved}{C.RESET}  ·  스킵: {C.YELLOW}{total_skipped}{C.RESET}", flush=True)
    if failed_channels:
        print(f"  {C.RED}실패 채널: {', '.join(failed_channels)}{C.RESET}", flush=True)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
