"use client";

import VoteButton from "@/components/VoteButton";
import type { Restaurant } from "@/lib/api";

type Props = {
  rows: Restaurant[];
  myVotes?: Record<string, 1 | -1>;
  onMyVoteChange?: (restaurantId: number, myVote: 1 | -1 | null) => void;
};

/** 검색 결과 — 그리드 뷰. 한 줄에 5개 × 6줄 = 30개/페이지. 식당 좋아요/싫어요 투표 가능. */
export default function RestaurantGrid({ rows, myVotes, onMyVoteChange }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400">
        검색 결과가 없습니다.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {rows.map((r) => {
        const mv = myVotes?.[String(r.id)] ?? null;
        return (
          <li
            key={r.id}
            className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand hover:bg-brand-surface"
          >
            {/* 제목 — font-soft bold + 진한 네이비 */}
            <div
              className="font-soft text-base font-bold tracking-tight line-clamp-1"
              style={{ color: "rgb(20 30 80)" }}
            >
              {r.current_name}
            </div>
            {/* 주소 */}
            <div className="mt-1 line-clamp-2 text-sm text-neutral-600">{r.current_address}</div>

            {/* 카테고리 + 식당 투표 — 카드 하단 정렬 */}
            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
              {r.cuisine ? (
                <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold leading-none text-neutral-600">
                  {r.cuisine}
                </span>
              ) : (
                <span />
              )}
              <VoteButton
                target_type="restaurant"
                target_id={r.id}
                initialLikes={r.likes ?? 0}
                initialDislikes={r.dislikes ?? 0}
                initialMyVote={mv}
                onChange={(next) => onMyVoteChange?.(r.id, next.myVote)}
                size="sm"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
