"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import RankingList from "@/components/RankingList";
import { api, type AppearanceScore, type RankingRow } from "@/lib/api";

export default function VotePage() {
  const [restaurants, setRestaurants] = useState<RankingRow[]>([]);
  const [channels, setChannels] = useState<RankingRow[]>([]);
  const [videos, setVideos] = useState<AppearanceScore[]>([]);
  const [trending, setTrending] = useState<AppearanceScore[]>([]);

  useEffect(() => {
    api.topRestaurants(20).then((rs) =>
      setRestaurants(
        rs.map((r) => ({
          id: r.id,
          name: r.current_name,
          likes: r.likes ?? 0,
          dislikes: r.dislikes ?? 0,
          net_score: r.net_score ?? 0,
        })),
      ),
    );
    api.channelRanking().then(setChannels).catch(() => setChannels([]));
    api.appearanceRanking().then(setVideos).catch(() => setVideos([]));
    api.trendingAppearances().then(setTrending).catch(() => setTrending([]));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">투표 · 랭킹</h1>
      <p className="text-sm font-bold text-neutral-500">
        아이디당 대상별 1회 투표. 좋아요/싫어요로 랭킹이 갱신됩니다.
      </p>

      {/* 인기 급상승 영상 — 최근 7일 좋아요 가중치 */}
      <TrendingSection rows={trending} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankingList title="맛집 랭킹" rows={restaurants} targetType="restaurant" />
        <RankingList title="채널 랭킹" rows={channels} targetType="channel" />
      </div>

      <VideoRanking rows={videos} />
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

function VideoRanking({ rows }: { rows: AppearanceScore[] }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-soft mb-3 text-xl font-bold text-brand">영상 좋아요 랭킹</h2>
      <ol className="divide-y divide-neutral-100">
        {rows.map((v, i) => (
          <li key={v.appearance_id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <Link href={`/restaurants/${v.restaurant_id}`} className="flex items-center gap-3 min-w-0">
              <span className="w-6 text-right font-mono text-neutral-500">{i + 1}</span>
              <span className="font-bold truncate">{v.episode_title ?? "-"}</span>
            </Link>
            <span className="shrink-0 text-xs font-bold text-neutral-500">
              👍 {v.likes} · 👎 {v.dislikes ?? 0}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-4 text-center text-sm text-neutral-400">데이터가 없습니다.</li>
        )}
      </ol>
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
