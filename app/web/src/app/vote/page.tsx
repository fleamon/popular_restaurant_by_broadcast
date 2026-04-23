"use client";

import { useEffect, useState } from "react";

import RankingList from "@/components/RankingList";
import { api, type RankingRow } from "@/lib/api";

export default function VotePage() {
  const [restaurants, setRestaurants] = useState<RankingRow[]>([]);
  const [channels, setChannels] = useState<RankingRow[]>([]);

  useEffect(() => {
    // 맛집 랭킹은 top API 를 가공해서 사용.
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
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand">투표</h1>
      <p className="text-sm text-neutral-500">
        아이디당 대상별 1회 투표. 좋아요/싫어요로 랭킹이 바뀝니다. (추후 "최근 30일 HOT", "숨은 보석" 뷰 추가 예정)
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <RankingList title="🍽 맛집 랭킹" rows={restaurants} targetType="restaurant" />
        <RankingList title="📺 채널 랭킹" rows={channels} targetType="channel" />
      </div>
    </div>
  );
}
