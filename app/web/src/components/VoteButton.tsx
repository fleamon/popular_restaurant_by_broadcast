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
  /** 컴팩트 모드 — 영상 행 처럼 좁은 공간용 */
  size?: "sm" | "md";
};

/** 좋아요 토글 — 누르면 좋아요, 다시 누르면 취소.
 *  (싫어요는 UI 에서 제거됨. dislikes 는 백엔드 호환을 위해 prop/onChange 에만 남기고 표시하지 않음.)
 */
export default function VoteButton({
  target_type,
  target_id,
  initialLikes = 0,
  initialDislikes = 0,
  initialMyVote = null,
  onChange,
  size = "md",
}: Props) {
  const [likes, setLikes] = useState(initialLikes);
  // dislikes 는 표시하지 않지만, 과거 싫어요(-1)를 좋아요로 전환할 때 카운트 보정 + onChange 호환을 위해 유지.
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [myVote, setMyVote] = useState<1 | -1 | null>(initialMyVote);
  const [busy, setBusy] = useState(false);

  // 부모가 myVotes 를 비동기 로드 → 그 결과 prop 으로 내려오면 반영
  useEffect(() => { setMyVote(initialMyVote); }, [initialMyVote]);
  useEffect(() => { setLikes(initialLikes); }, [initialLikes]);
  useEffect(() => { setDislikes(initialDislikes); }, [initialDislikes]);

  async function handleLike() {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { alert("로그인이 필요합니다."); return; }

      let nextLikes = likes;
      let nextDislikes = dislikes;
      let nextMyVote: 1 | -1 | null;

      if (myVote === 1) {
        // 좋아요 취소
        await api.unvote(target_type, target_id);
        nextLikes = Math.max(0, likes - 1);
        nextMyVote = null;
      } else {
        // 좋아요 — 이전에 싫어요였다면 그 카운트 보정
        await api.vote({ target_type, target_id, value: 1 });
        nextLikes = likes + 1;
        if (myVote === -1) nextDislikes = Math.max(0, dislikes - 1);
        nextMyVote = 1;
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

  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-3 py-1.5";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const txt = size === "sm" ? "text-[11px]" : "text-sm";

  return (
    <div
      className={[
        "inline-flex overflow-hidden rounded-lg border bg-white",
        busy ? "opacity-60" : "",
        txt,
      ].join(" ")}
      style={{ borderColor: "rgb(225 230 240)" }}
    >
      <button
        type="button"
        onClick={() => void handleLike()}
        disabled={busy}
        aria-pressed={likeActive}
        aria-label="좋아요"
        className={[
          "flex items-center gap-1 transition-colors",
          pad,
          likeActive
            ? "bg-brand text-brand-fg font-bold"
            : "text-neutral-700 hover:bg-brand-surface",
        ].join(" ")}
      >
        <ThumbUpIcon className={iconSize} />
        <span className="tabular-nums font-bold">{likes}</span>
      </button>
    </div>
  );
}

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 7.59 6.59C7.22 6.95 7 7.45 7 8v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z"/>
    </svg>
  );
}
