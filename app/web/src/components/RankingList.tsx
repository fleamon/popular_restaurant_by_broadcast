"use client";

import { useEffect, useMemo, useState } from "react";

import type { RankingRow } from "@/lib/api";
import Pagination from "./Pagination";
import VoteButton from "./VoteButton";

type Props = {
  title: string;
  rows: RankingRow[];
  targetType: "restaurant" | "channel";
  /** target_id → 1/-1, 미투표는 키 부재 */
  myVotes?: Record<string, 1 | -1>;
};

const PAGE_SIZE = 10;

/** 좋아요 desc 정렬 + 이름 like 검색 + 10개씩 페이지네이션. 카운터·내 투표 상태는 VoteButton 이 관리. */
export default function RankingList({ title, rows, targetType, myVotes }: Props) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [q]);

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
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">{title}</h2>
        <span className="text-xs font-bold text-neutral-400">총 {sorted.length}</span>
      </div>
      <input
        placeholder="이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
      />
      <ol className="divide-y divide-neutral-100">
        {visible.map((r, i) => {
          const globalRank = (page - 1) * PAGE_SIZE + i + 1;
          const myVote = myVotes?.[String(r.id)] ?? null;
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <RankBadge n={globalRank} />
                <span
                  className="truncate font-bold"
                  style={{ color: "rgb(20 30 80)" }}
                >
                  {r.name}
                </span>
              </div>
              <VoteButton
                target_type={targetType}
                target_id={r.id}
                initialLikes={r.likes}
                initialDislikes={r.dislikes}
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

/** 순위 배지 — 상위 3등은 강조 (brand 채워짐), 나머지는 옅은 회색 outline. */
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

// Pagination 은 components/Pagination.tsx 로 이동 — re-export 로 기존 import 호환 유지.
export { default as Pagination } from "./Pagination";
