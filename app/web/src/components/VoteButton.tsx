"use client";

import { useEffect, useState } from "react";

import { api, type VoteBody } from "@/lib/api";
import { getSupabaseBrowser } from "@/lib/supabase";

type Props = Omit<VoteBody, "value"> & {
  initialLikes?: number;
  initialDislikes?: number;
  /** 현재 user 가 이 대상에 이미 한 투표값. 없으면 null. */
  initialMyVote?: 1 | -1 | null;
  /** 클릭 후 새 상태 알림 — 부모가 다른 인스턴스(같은 target)들 동기화하는데 사용. */
  onChange?: (next: { likes: number; dislikes: number; myVote: 1 | -1 | null }) => void;
};

/** 좋아요/싫어요 토글 — 같은 버튼 다시 누르면 취소, 반대 버튼 누르면 갱신.
 *  좌측 카운터는 로컬 state 로 즉시 반영 (서버 라운드트립 안 기다리고 낙관적 갱신).
 */
export default function VoteButton({
  target_type,
  target_id,
  initialLikes = 0,
  initialDislikes = 0,
  initialMyVote = null,
  onChange,
}: Props) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [myVote, setMyVote] = useState<1 | -1 | null>(initialMyVote);
  const [busy, setBusy] = useState(false);

  // 부모가 myVotes 를 비동기 로드 → 그 결과 prop 으로 내려오면 반영
  useEffect(() => { setMyVote(initialMyVote); }, [initialMyVote]);
  useEffect(() => { setLikes(initialLikes); }, [initialLikes]);
  useEffect(() => { setDislikes(initialDislikes); }, [initialDislikes]);

  async function handleClick(clicked: 1 | -1) {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { alert("로그인이 필요합니다."); return; }

      let nextLikes = likes;
      let nextDislikes = dislikes;
      let nextMyVote: 1 | -1 | null = myVote;

      if (myVote === clicked) {
        await api.unvote(target_type, target_id);
        if (clicked === 1) nextLikes = Math.max(0, likes - 1);
        else                nextDislikes = Math.max(0, dislikes - 1);
        nextMyVote = null;
      } else {
        await api.vote({ target_type, target_id, value: clicked });
        if (myVote === null) {
          if (clicked === 1) nextLikes = likes + 1;
          else                nextDislikes = dislikes + 1;
        } else {
          if (clicked === 1) { nextLikes = likes + 1; nextDislikes = Math.max(0, dislikes - 1); }
          else               { nextDislikes = dislikes + 1; nextLikes = Math.max(0, likes - 1); }
        }
        nextMyVote = clicked;
      }

      setLikes(nextLikes);
      setDislikes(nextDislikes);
      setMyVote(nextMyVote);
      onChange?.({ likes: nextLikes, dislikes: nextDislikes, myVote: nextMyVote });
    } catch (e) {
      alert(`투표 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const likeActive = myVote === 1;
  const dislikeActive = myVote === -1;

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => void handleClick(1)}
        disabled={busy}
        aria-pressed={likeActive}
        className={[
          "rounded-md border px-2 py-1 transition-colors disabled:opacity-50",
          likeActive ? "border-brand bg-brand text-brand-fg font-bold" : "hover:bg-brand-surface",
        ].join(" ")}
      >
        👍 {likes}
      </button>
      <button
        onClick={() => void handleClick(-1)}
        disabled={busy}
        aria-pressed={dislikeActive}
        className={[
          "rounded-md border px-2 py-1 transition-colors disabled:opacity-50",
          dislikeActive ? "border-neutral-700 bg-neutral-700 text-white font-bold" : "hover:bg-neutral-50",
        ].join(" ")}
      >
        👎 {dislikes}
      </button>
    </div>
  );
}
