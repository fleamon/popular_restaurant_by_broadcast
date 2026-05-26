"use client";

import BookmarkButton from "@/components/BookmarkButton";
import VoteButton from "@/components/VoteButton";
import VoteLabel from "@/components/VoteLabel";
import type { Restaurant } from "@/lib/api";

type Props = {
  rows: Restaurant[];
  myVotes?: Record<string, 1 | -1>;
  onMyVoteChange?: (restaurantId: number, myVote: 1 | -1 | null) => void;
  myBookmarks?: Record<string, true>;
  onBookmarkChange?: (restaurantId: number, bookmarked: boolean) => void;
};

/** 검색 결과 — 리스트 뷰. 식당 좋아요/싫어요 투표 가능. */
export default function RestaurantList({ rows, myVotes, onMyVoteChange, myBookmarks, onBookmarkChange }: Props) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {rows.map((r) => {
        const mv = myVotes?.[String(r.id)] ?? null;
        const isBookmarked = myBookmarks?.[String(r.id)] ?? false;
        return (
          <li key={r.id} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-brand-surface">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-soft truncate text-base font-bold tracking-tight"
                  style={{ color: "rgb(20 30 80)" }}
                >
                  {r.current_name}
                </span>
                {r.cuisine && <CategoryChip text={r.cuisine} />}
              </div>
              <div className="mt-1 truncate text-sm text-neutral-600">{r.current_address}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {myBookmarks !== undefined && (
                <BookmarkButton
                  target_type="restaurant"
                  target_id={r.id}
                  initialBookmarked={isBookmarked}
                  onChange={(id, bm) => onBookmarkChange?.(id, bm)}
                  size="sm"
                />
              )}
              <VoteLabel kind="restaurant" />
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

function CategoryChip({ text }: { text: string }) {
  return (
    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold leading-none text-neutral-600">
      {text}
    </span>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400">
      검색 결과가 없습니다.
    </div>
  );
}
