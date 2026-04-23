"use client";

import type { RankingRow } from "@/lib/api";
import VoteButton from "./VoteButton";

type Props = {
  title: string;
  rows: RankingRow[];
  targetType: "restaurant" | "channel";
};

export default function RankingList({ title, rows, targetType }: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold text-brand">{title}</h2>
      <ol className="divide-y divide-neutral-100">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-6 text-right font-mono text-neutral-500">{i + 1}</span>
              <span className="font-medium">{r.name}</span>
            </div>
            <VoteButton
              target_type={targetType}
              target_id={r.id}
              initialLikes={r.likes}
              initialDislikes={r.dislikes}
            />
          </li>
        ))}
        {rows.length === 0 && <li className="py-4 text-center text-sm text-neutral-400">데이터가 아직 없습니다.</li>}
      </ol>
    </section>
  );
}
