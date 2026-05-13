"""기존 식당 데이터의 naver_place_id / naver_map_url 을 네이버 매칭 결과로 일괄 갱신.

분점 접미사(본점/분점/지점/직영점/N호점) 제거 변형까지 시도해 누락 없이 매칭한다.
좌표 없는 식당은 검증이 불가능하니 건너뜀.

사용:
    python -m data.seed_naver_places                 # naver_place_id 비어있는 행만
    python -m data.seed_naver_places --force         # 이미 채워진 행도 다시 시도
    python -m data.seed_naver_places --limit 100     # 최대 N건만 처리 (테스트용)
    python -m data.seed_naver_places --sleep 0.5     # 변형 간 sleep (기본 0.3, 봇차단 회피)

ANSI 색 출력 + 진행률. 종료 코드: 0 (모두 매칭/스킵 성공), 2 (일부 실패).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

from supabase import create_client

from app.api.services import naver_match


class C:
    RESET = "\033[0m"
    DIM = "\033[2m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    BLUE = "\033[34m"


def _client():
    cfg = json.loads(pathlib.Path("config/secrets.json").read_text(encoding="utf-8"))
    return create_client(cfg["supabase"]["url"], cfg["supabase"]["service_role_key"])


def _iter_targets(sb, force: bool, page_size: int = 500):
    """좌표 있는 식당을 페이지네이션으로 yield. force=False 면 naver_place_id NULL 만."""
    start = 0
    while True:
        q = sb.table("restaurants").select(
            "id, current_name, current_address, lat, lng, naver_place_id"
        ).order("id").range(start, start + page_size - 1)
        # postgrest IS NOT NULL — supabase-py 는 .not_.is_('col', 'null')
        q = q.not_.is_("lat", "null").not_.is_("lng", "null")
        if not force:
            q = q.is_("naver_place_id", "null")
        rows = q.execute().data or []
        if not rows:
            break
        for r in rows:
            yield r
        if len(rows) < page_size:
            break
        start += page_size


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="data.seed_naver_places",
                                description="네이버 place_id 일괄 매칭 (분점 변형 자동 시도)")
    p.add_argument("--force", action="store_true", help="이미 채워진 행도 다시 매칭")
    p.add_argument("--limit", type=int, default=0, help="최대 처리 건수 (0 = 무제한)")
    p.add_argument("--sleep", type=float, default=0.3, help="변형 간 sleep 초 (기본 0.3)")
    args = p.parse_args(argv)

    sb = _client()

    total = ok = miss = err = 0
    start_time = time.time()
    print(f"{C.BOLD}네이버 place 매칭 일괄 갱신{C.RESET}  force={args.force}  sleep={args.sleep}s\n", flush=True)

    try:
        for r in _iter_targets(sb, args.force):
            if args.limit and total >= args.limit:
                break
            total += 1
            name = r["current_name"]
            try:
                m = naver_match.match(name, r["current_address"], r["lat"], r["lng"], sleep_between=args.sleep)
            except Exception as e:
                err += 1
                print(f"  {C.RED}[ERR]{C.RESET} #{r['id']:<5} {name} — {e}", flush=True)
                continue

            if not m:
                miss += 1
                print(f"  {C.YELLOW}[no ]{C.RESET} #{r['id']:<5} {name}", flush=True)
                continue

            sb.table("restaurants").update({
                "naver_place_id": m.place_id,
                "naver_map_url": naver_match.naver_place_url(m.place_id),
            }).eq("id", r["id"]).execute()
            ok += 1
            print(f"  {C.GREEN}[ok ]{C.RESET} #{r['id']:<5} {name:<25} → {m.place_id} ({m.distance_m:.0f}m) via {C.DIM}'{m.matched_query}'{C.RESET}", flush=True)

            if total % 50 == 0:
                el = time.time() - start_time
                rate = total / el if el > 0 else 0
                print(f"\n{C.BLUE}--- 진행 {total}건 — ok {ok} / miss {miss} / err {err} — {rate:.1f}건/s ---{C.RESET}\n", flush=True)

    except KeyboardInterrupt:
        print(f"\n{C.YELLOW}중단됨 (Ctrl-C){C.RESET}", flush=True)

    el = time.time() - start_time
    print(f"\n{C.BOLD}완료{C.RESET} — 총 {total}건  ok={C.GREEN}{ok}{C.RESET}  miss={C.YELLOW}{miss}{C.RESET}  err={C.RED}{err}{C.RESET}  소요 {el/60:.1f}분", flush=True)
    return 0 if err == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
