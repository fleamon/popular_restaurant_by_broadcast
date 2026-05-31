"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BookmarkButton from "@/components/BookmarkButton";
import RankingList from "@/components/RankingList";
import VoteButton from "@/components/VoteButton";
import PageHeader from "@/components/ui/PageHeader";
import { api, type AppearanceScore, type RankingRow } from "@/lib/api";

type MyVotes = Record<string, 1 | -1>;
type PeriodPreset = "all" | "today" | "7d" | "30d" | "custom";

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

export default function VotePage() {
  const [restaurants, setRestaurants] = useState<RankingRow[]>([]);
  const [channels, setChannels] = useState<RankingRow[]>([]);
  const [videos, setVideos] = useState<AppearanceScore[]>([]);
  const [trending, setTrending] = useState<AppearanceScore[]>([]);

  const [myR, setMyR] = useState<MyVotes>({});
  const [myC, setMyC] = useState<MyVotes>({});
  const [myA, setMyA] = useState<MyVotes>({});

  // 북마크 상태 — undefined: 미로그인
  const [myBR, setMyBR] = useState<Record<string, true> | undefined>(undefined);
  const [myBC, setMyBC] = useState<Record<string, true> | undefined>(undefined);
  const [myBA, setMyBA] = useState<Record<string, true> | undefined>(undefined);

  useEffect(() => {
    api.topRestaurants().then((rs) =>
      setRestaurants(rs.map((r) => ({
        id: r.id,
        name: r.current_name,
        likes: r.likes ?? 0,
        dislikes: r.dislikes ?? 0,
        net_score: r.net_score ?? 0,
      })))
    ).catch(() => setRestaurants([]));
    api.channelRanking().then(setChannels).catch(() => setChannels([]));
    api.appearanceRanking().then(setVideos).catch(() => setVideos([]));
    api.trendingAppearances().then(setTrending).catch(() => setTrending([]));
    api.myVotes("restaurant").then(setMyR).catch(() => setMyR({}));
    api.myVotes("channel").then(setMyC).catch(() => setMyC({}));
    api.myVotes("appearance").then(setMyA).catch(() => setMyA({}));
    api.bookmarkIds().then((ids) => {
      const r: Record<string, true> = {};
      const c: Record<string, true> = {};
      const a: Record<string, true> = {};
      for (const key of Object.keys(ids)) {
        if (key.startsWith("restaurant:")) r[key.slice("restaurant:".length)] = true;
        else if (key.startsWith("channel:"))    c[key.slice("channel:".length)] = true;
        else if (key.startsWith("appearance:")) a[key.slice("appearance:".length)] = true;
      }
      setMyBR(r); setMyBC(c); setMyBA(a);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="투표 · 랭킹" />

      <div className="rounded-xl border border-dashed border-brand bg-brand-surface p-3 text-sm font-bold text-brand">
        ℹ 한 아이디는 하루에 한 번 맛집·채널·영상 각 1회씩 좋아요 투표할 수 있습니다.
      </div>

      <TrendingSection rows={trending} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankingList
          title="맛집 랭킹"
          rows={restaurants}
          targetType="restaurant"
          myVotes={myR}
          myBookmarks={myBR}
          onBookmarkChange={(id, bm) =>
            setMyBR((prev) => {
              if (!prev) return prev;
              const next = { ...prev };
              if (bm) next[String(id)] = true; else delete next[String(id)];
              return next;
            })}
        />
        <RankingList
          title="채널 랭킹"
          rows={channels}
          targetType="channel"
          myVotes={myC}
          myBookmarks={myBC}
          onBookmarkChange={(id, bm) =>
            setMyBC((prev) => {
              if (!prev) return prev;
              const next = { ...prev };
              if (bm) next[String(id)] = true; else delete next[String(id)];
              return next;
            })}
        />
      </div>

      <VideoRanking
        rows={videos}
        myVotes={myA}
        myBookmarks={myBA}
        onBookmarkChange={(id, bm) =>
          setMyBA((prev) => {
            if (!prev) return prev;
            const next = { ...prev };
            if (bm) next[String(id)] = true; else delete next[String(id)];
            return next;
          })}
      />
    </div>
  );
}

function TrendingSection({ rows }: { rows: AppearanceScore[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TrendingIcon />
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">인기 급상승 영상</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-neutral-400">아직 데이터가 없습니다.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, 6).map((v, i) => (
            <li
              key={v.appearance_id}
              className="rounded-lg border border-neutral-100 bg-white p-3 transition-colors hover:border-brand hover:bg-brand-surface"
            >
              <Link href={`/restaurants/${v.restaurant_id}`}>
                <div className="flex items-start gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-brand-fg text-xs font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <span
                    className="font-soft text-sm font-bold leading-snug line-clamp-2"
                    style={{ color: "rgb(20 30 80)" }}
                  >
                    {v.episode_title ?? "-"}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-surface px-2 py-0.5 text-[11px] font-bold text-brand tabular-nums">
                  급상승 {Math.round(Number(v.trend_score ?? 0))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const VIDEO_PAGE_SIZE = 10;

function VideoRanking({
  rows: allTimeRows,
  myVotes,
  myBookmarks,
  onBookmarkChange,
}: {
  rows: AppearanceScore[];
  myVotes: MyVotes;
  myBookmarks?: Record<string, true>;
  onBookmarkChange?: (id: number, bookmarked: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(todayKst());
  const [periodRows, setPeriodRows] = useState<AppearanceScore[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 투표 후 상태 즉시 반영
  const [localVotes, setLocalVotes] = useState<MyVotes>(myVotes ?? {});
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
    api.appearanceRankingByPeriod(from, to)
      .then(setPeriodRows)
      .catch(() => setPeriodRows([]))
      .finally(() => setLoading(false));
  }, [period, fromDate, toDate]);

  const rows = periodRows ?? allTimeRows;

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((v) => {
          const hay = [v.episode_title, v.channel_name, v.restaurant_name].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(needle);
        })
      : rows;
    return [...filtered].sort((a, b) => {
      const dl = b.likes - a.likes;
      if (dl !== 0) return dl;
      const dd = (a.dislikes ?? 0) - (b.dislikes ?? 0);
      if (dd !== 0) return dd;
      return b.appearance_id - a.appearance_id;
    });
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / VIDEO_PAGE_SIZE));
  const visible = sorted.slice((page - 1) * VIDEO_PAGE_SIZE, page * VIDEO_PAGE_SIZE);

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">영상 랭킹</h2>
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
        placeholder="영상 제목 / 채널 / 식당 이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
      />

      {loading ? (
        <div className="py-6 text-center text-sm font-bold text-neutral-400">불러오는 중…</div>
      ) : (
        <ol className="divide-y divide-neutral-100">
          {visible.map((v, i) => {
            const rank = (page - 1) * VIDEO_PAGE_SIZE + i + 1;
            const top = rank <= 3;
            const myVote = localVotes[String(v.appearance_id)] ?? null;
            const isBookmarked = myBookmarks?.[String(v.appearance_id)] ?? false;
            return (
              <li key={v.appearance_id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/restaurants/${v.restaurant_id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={[
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                      top ? "bg-brand text-brand-fg" : "border border-neutral-200 bg-neutral-50 text-neutral-500",
                    ].join(" ")}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-soft truncate text-sm font-bold leading-snug" style={{ color: "rgb(20 30 80)" }}>
                      {v.episode_title ?? "-"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {v.channel_name && (
                        <span className="max-w-[7rem] truncate rounded-md bg-brand-surface px-1.5 py-0.5 font-bold leading-none text-brand">
                          📺 {v.channel_name}
                        </span>
                      )}
                      {v.restaurant_name && (
                        <span className="max-w-[7rem] truncate rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold leading-none text-neutral-700">
                          🍽 {v.restaurant_name}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {myBookmarks !== undefined && (
                    <BookmarkButton
                      target_type="appearance"
                      target_id={v.appearance_id}
                      initialBookmarked={isBookmarked}
                      onChange={(id, bm) => onBookmarkChange?.(id, bm)}
                      size="sm"
                    />
                  )}
                  <VoteButton
                    target_type="appearance"
                    target_id={v.appearance_id}
                    initialLikes={localCounts[String(v.appearance_id)]?.likes ?? v.likes}
                    initialDislikes={localCounts[String(v.appearance_id)]?.dislikes ?? (v.dislikes ?? 0)}
                    initialMyVote={myVote}
                    onChange={(next) => {
                      setLocalCounts((prev) => ({ ...prev, [String(v.appearance_id)]: { likes: next.likes, dislikes: next.dislikes } }));
                      setLocalVotes((prev) => {
                        const nxt = { ...prev };
                        if (next.myVote === null) delete nxt[String(v.appearance_id)];
                        else nxt[String(v.appearance_id)] = next.myVote;
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
      <VideoRankingPagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}

function VideoRankingPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 disabled:opacity-40 hover:bg-brand-surface hover:text-brand"
      >
        이전
      </button>
      <span className="text-xs font-bold text-neutral-500">{page} / {totalPages}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 disabled:opacity-40 hover:bg-brand-surface hover:text-brand"
      >
        다음
      </button>
    </div>
  );
}

function TrendingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" fill="none" stroke="rgb(44 66 163)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h7v7" fill="none" stroke="rgb(44 66 163)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
