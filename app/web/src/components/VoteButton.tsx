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

/** 좋아요/싫어요 토글 — 같은 버튼 다시 누르면 취소, 반대 버튼 누르면 갱신.
 *  segmented control 디자인 — 두 버튼이 하나로 묶여 보이고, 활성 상태는 브랜드 컬러로 채워짐.
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
        onClick={() => void handleClick(1)}
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
      <div className="w-px" style={{ background: "rgb(225 230 240)" }} />
      <button
        type="button"
        onClick={() => void handleClick(-1)}
        disabled={busy}
        aria-pressed={dislikeActive}
        aria-label="싫어요"
        className={[
          "flex items-center gap-1 transition-colors",
          pad,
          dislikeActive
            ? "bg-neutral-800 text-white font-bold"
            : "text-neutral-500 hover:bg-neutral-100",
        ].join(" ")}
      >
        <ThumbDownIcon className={iconSize} />
        <span className="tabular-nums font-bold">{dislikes}</span>
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

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
    </svg>
  );
}
