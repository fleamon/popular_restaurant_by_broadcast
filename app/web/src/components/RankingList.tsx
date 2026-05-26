"use client";

import { useEffect, useMemo, useState } from "react";

import { api, type RankingRow } from "@/lib/api";
import BookmarkButton from "./BookmarkButton";
import Pagination from "./Pagination";
import VoteButton from "./VoteButton";

type PeriodPreset = "all" | "today" | "7d" | "30d" | "custom";

type Props = {
  title: string;
  rows: RankingRow[];
  targetType: "restaurant" | "channel";
  myVotes?: Record<string, 1 | -1>;
  myBookmarks?: Record<string, true>;
  onBookmarkChange?: (id: number, bookmarked: boolean) => void;
};

const PAGE_SIZE = 10;

const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all",    label: "전체" },
  { value: "today",  label: "오늘" },
  { value: "7d",     label: "7일" },
  { value: "30d",    label: "30일" },
  { value: "custom", label: "직접" },
];

function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
function daysAgoKst(n: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 - n * 86400000);
  return kst.toISOString().slice(0, 10);
}

/** 좋아요 desc 정렬 + 이름 like 검색 + 10개씩 페이지네이션. 기간 필터 포함. */
export default function RankingList({ title, rows: allTimeRows, targetType, myVotes, myBookmarks, onBookmarkChange }: Props) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(todayKst());
  const [periodRows, setPeriodRows] = useState<RankingRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 투표 후 페이지 내에서 상태 유지 (router cache 로 인해 컴포넌트가 재마운트 안 될 때도 정확히 반영)
  const [localVotes, setLocalVotes] = useState<Record<string, 1 | -1>>(myVotes ?? {});
  const [localCounts, setLocalCounts] = useState<Record<string, { likes: number; dislikes: number }>>({});
  useEffect(() => { setLocalVotes(myVotes ?? {}); }, [myVotes]);

  useEffect(() => { setPage(1); }, [q, period]);

  useEffect(() => {
    if (period === "all") { setPeriodRows(null); return; }
    let from: string | undefined;
    let to: string | undefined;
    const today = todayKst();
    if (period === "today") { from = today; to = today; }
    else if (period === "7d")  { from = daysAgoKst(7);  to = today; }
    else if (period === "30d") { from = daysAgoKst(30); to = today; }
    else {
      if (!fromDate || !toDate) return;
      from = fromDate; to = toDate;
    }
    setLoading(true);
    const fetchFn = targetType === "restaurant"
      ? api.restaurantRankingByPeriod(from, to)
      : api.channelRankingByPeriod(from, to);
    fetchFn
      .then(setPeriodRows)
      .catch(() => setPeriodRows([]))
      .finally(() => setLoading(false));
  }, [period, fromDate, toDate, targetType]);

  const rows = periodRows ?? allTimeRows;

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) => (r.name ?? "").toLowerCase().includes(needle))
      : rows;
    return [...filtered].sort((a, b) => b.likes - a.likes);
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">{title}</h2>
        <span className="text-xs font-bold text-neutral-400">총 {sorted.length}</span>
      </div>

      {/* 기간 필터 */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={[
              "rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
              period === p.value
                ? "bg-brand text-brand-fg"
                : "bg-neutral-100 text-neutral-600 hover:bg-brand-surface hover:text-brand",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="mb-2 flex gap-2">
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-bold focus:border-brand focus:outline-none"
          />
          <span className="self-center text-xs text-neutral-400">~</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-bold focus:border-brand focus:outline-none"
          />
        </div>
      )}

      <input
        placeholder="이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
      />

      {loading ? (
        <div className="py-6 text-center text-sm font-bold text-neutral-400">불러오는 중…</div>
      ) : (
        <ol className="divide-y divide-neutral-100">
          {visible.map((r, i) => {
            const globalRank = (page - 1) * PAGE_SIZE + i + 1;
            const myVote = localVotes[String(r.id)] ?? null;
            const isBookmarked = myBookmarks?.[String(r.id)] ?? false;
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <RankBadge n={globalRank} />
                  <span className="truncate font-bold" style={{ color: "rgb(20 30 80)" }}>
                    {r.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {myBookmarks !== undefined && (
                    <BookmarkButton
                      target_type={targetType}
                      target_id={r.id}
                      initialBookmarked={isBookmarked}
                      onChange={(id, bm) => onBookmarkChange?.(id, bm)}
                      size="sm"
                    />
                  )}
                  <VoteButton
                    target_type={targetType}
                    target_id={r.id}
                    initialLikes={localCounts[String(r.id)]?.likes ?? r.likes}
                    initialDislikes={localCounts[String(r.id)]?.dislikes ?? r.dislikes}
                    initialMyVote={myVote}
                    onChange={(next) => {
                      setLocalCounts((prev) => ({ ...prev, [String(r.id)]: { likes: next.likes, dislikes: next.dislikes } }));
                      setLocalVotes((prev) => {
                        const nxt = { ...prev };
                        if (next.myVote === null) delete nxt[String(r.id)];
                        else nxt[String(r.id)] = next.myVote;
                        return nxt;
                      });
                    }}
                    size="sm"
                  />
                </div>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="py-4 text-center text-sm font-bold text-neutral-400">결과가 없습니다.</li>
          )}
        </ol>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}

function RankBadge({ n }: { n: number }) {
  const top = n <= 3;
  return (
    <span
      className={[
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
        top ? "bg-brand text-brand-fg" : "border border-neutral-200 bg-neutral-50 text-neutral-500",
      ].join(" ")}
    >
      {n}
    </span>
  );
}

export { default as Pagination } from "./Pagination";
