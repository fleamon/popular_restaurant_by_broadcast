"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import RankingList, { Pagination } from "@/components/RankingList";
import VoteButton from "@/components/VoteButton";
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
    api.topRestaurants(1000).then((rs) =>
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
      <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">투표 · 랭킹</h1>
      <p className="text-sm font-bold text-neutral-500">
        아이디당 대상별 1회 투표. 같은 버튼 다시 누르면 취소, 반대 버튼 누르면 전환됩니다.
      </p>

      {/* 인기 급상승 영상 — 최근 7일 좋아요 가중치 */}
      <TrendingSection rows={trending} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankingList title="맛집 랭킹" rows={restaurants} targetType="restaurant" myVotes={myR} />
        <RankingList title="채널 랭킹" rows={channels} targetType="channel" myVotes={myC} />
      </div>

      <VideoRanking rows={videos} myVotes={myA} />
    </div>
  );
}

function TrendingSection({ rows }: { rows: AppearanceScore[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingIcon />
        <h2 className="font-soft text-xl font-bold text-brand">인기 급상승 영상</h2>
        <span className="text-xs font-bold text-neutral-400">최근 7일 좋아요에 가중치 3 적용</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">아직 데이터가 없습니다.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, 6).map((v, i) => (
            <li key={v.appearance_id} className="rounded-lg border border-neutral-100 p-3 hover:border-brand transition-colors">
              <Link href={`/restaurants/${v.restaurant_id}`}>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-fg text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 line-clamp-1">{v.episode_title ?? "-"}</span>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  급상승점수 {Math.round(Number(v.trend_score ?? 0))}
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
    return [...filtered].sort((a, b) => b.likes - a.likes);
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / VIDEO_PAGE_SIZE));
  const visible = sorted.slice((page - 1) * VIDEO_PAGE_SIZE, page * VIDEO_PAGE_SIZE);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-soft text-xl font-bold text-brand">영상 좋아요 랭킹</h2>
        <span className="text-xs text-neutral-400">총 {sorted.length}</span>
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
          const myVote = myVotes[String(v.appearance_id)] ?? null;
          return (
            <li key={v.appearance_id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/restaurants/${v.restaurant_id}`} className="flex flex-1 items-center gap-3 min-w-0">
                <span className="w-6 shrink-0 text-right font-mono text-neutral-500">{rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-neutral-900">{v.episode_title ?? "-"}</div>
                  <div className="mt-0.5 truncate text-xs text-neutral-500">
                    {v.channel_name && <span className="font-bold text-brand">📺 {v.channel_name}</span>}
                    {v.channel_name && v.restaurant_name && <span className="mx-1">·</span>}
                    {v.restaurant_name && <span>🍽 {v.restaurant_name}</span>}
                  </div>
                </div>
              </Link>
              <VoteButton
                target_type="appearance"
                target_id={v.appearance_id}
                initialLikes={v.likes}
                initialDislikes={v.dislikes ?? 0}
                initialMyVote={myVote}
              />
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-4 text-center text-sm text-neutral-400">결과가 없습니다.</li>
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
