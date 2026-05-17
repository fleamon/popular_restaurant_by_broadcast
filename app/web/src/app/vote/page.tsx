"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import RankingList, { Pagination } from "@/components/RankingList";
import VoteButton from "@/components/VoteButton";
import VotePeriodCompare from "@/components/VotePeriodCompare";
import PageHeader from "@/components/ui/PageHeader";
import { api, type AppearanceScore, type RankingRow } from "@/lib/api";

type MyVotes = Record<string, 1 | -1>;

export default function VotePage() {
  const [restaurants, setRestaurants] = useState<RankingRow[]>([]);
  const [channels, setChannels] = useState<RankingRow[]>([]);
  const [videos, setVideos] = useState<AppearanceScore[]>([]);
  const [trending, setTrending] = useState<AppearanceScore[]>([]);

  // 내 투표 상태 — target_type 별로 분리해 보관
  const [myR, setMyR] = useState<MyVotes>({});
  const [myC, setMyC] = useState<MyVotes>({});
  const [myA, setMyA] = useState<MyVotes>({});

  useEffect(() => {
    api.topRestaurants().then((rs) =>
      setRestaurants(
        rs.map((r) => ({
          id: r.id,
          name: r.current_name,
          likes: r.likes ?? 0,
          dislikes: r.dislikes ?? 0,
          net_score: r.net_score ?? 0,
        })),
      ),
    ).catch(() => setRestaurants([]));
    api.channelRanking().then(setChannels).catch(() => setChannels([]));
    api.appearanceRanking().then(setVideos).catch(() => setVideos([]));
    api.trendingAppearances().then(setTrending).catch(() => setTrending([]));

    // 로그인 안 된 경우 401 → 빈 객체로 폴백
    api.myVotes("restaurant").then(setMyR).catch(() => setMyR({}));
    api.myVotes("channel").then(setMyC).catch(() => setMyC({}));
    api.myVotes("appearance").then(setMyA).catch(() => setMyA({}));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="투표 · 랭킹" />

      {/* 안내문 — 투표 규칙 */}
      <div className="rounded-xl border border-dashed border-brand bg-brand-surface p-3 text-sm font-bold text-brand">
        ℹ 한 아이디는 하루에 맛집·채널·영상 각 1회씩 좋아요/싫어요 투표할 수 있습니다. (KST 자정 기준 갱신)
      </div>

      {/* 인기 급상승 영상 — 최근 7일 좋아요 가중치 */}
      <TrendingSection rows={trending} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankingList title="맛집 랭킹" rows={restaurants} targetType="restaurant" myVotes={myR} />
        <RankingList title="채널 랭킹" rows={channels} targetType="channel" myVotes={myC} />
      </div>

      <VideoRanking rows={videos} myVotes={myA} />

      <VotePeriodCompare />
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

/** 영상 좋아요 랭킹 — 채널명·식당명 함께 표시, 이름/제목/채널/식당 like 검색, 좋아요 desc, 10개씩 페이지. */
function VideoRanking({ rows, myVotes }: { rows: AppearanceScore[]; myVotes: MyVotes }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [q]);

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((v) => {
          const hay = [v.episode_title, v.channel_name, v.restaurant_name].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(needle);
        })
      : rows;
    // likes desc → dislikes asc (싫어요 많을수록 뒤로) → appearance_id desc 안정 키.
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
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">영상 좋아요 랭킹</h2>
        <span className="text-xs font-bold text-neutral-400">총 {sorted.length}</span>
      </div>
      <input
        placeholder="영상 제목 / 채널 / 식당 이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
      />
      <ol className="divide-y divide-neutral-100">
        {visible.map((v, i) => {
          const rank = (page - 1) * VIDEO_PAGE_SIZE + i + 1;
          const top = rank <= 3;
          const myVote = myVotes[String(v.appearance_id)] ?? null;
          return (
            <li key={v.appearance_id} className="flex items-center justify-between gap-3 py-3 text-sm">
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
                  {/* 영상 제목 — 가장 진한 강조 */}
                  <div
                    className="font-soft truncate text-sm font-bold leading-snug"
                    style={{ color: "rgb(20 30 80)" }}
                  >
                    {v.episode_title ?? "-"}
                  </div>
                  {/* 메타 라인 — 채널 / 식당. chip 두 개로 시각 분리, brand 톤만 사용 */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {v.channel_name && (
                      <span className="rounded-md bg-brand-surface px-1.5 py-0.5 font-bold leading-none text-brand">
                        📺 {v.channel_name}
                      </span>
                    )}
                    {v.restaurant_name && (
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold leading-none text-neutral-700">
                        🍽 {v.restaurant_name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <VoteButton
                target_type="appearance"
                target_id={v.appearance_id}
                initialLikes={v.likes}
                initialDislikes={v.dislikes ?? 0}
                initialMyVote={myVote}
                size="sm"
              />
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-4 text-center text-sm font-bold text-neutral-400">결과가 없습니다.</li>
        )}
      </ol>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}

// 디자인된 아이콘 (이모지 X) — 인기 급상승
function TrendingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M3 17l6-6 4 4 8-8"
        fill="none"
        stroke="rgb(44 66 163)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 7h7v7"
        fill="none"
        stroke="rgb(44 66 163)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
