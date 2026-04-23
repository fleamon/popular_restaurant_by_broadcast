"use client";

import { useState } from "react";

import { api, type VoteBody } from "@/lib/api";
import { getSupabaseBrowser } from "@/lib/supabase";

type Props = Omit<VoteBody, "value"> & {
  initialLikes?: number;
  initialDislikes?: number;
};

export default function VoteButton({ target_type, target_id, initialLikes = 0, initialDislikes = 0 }: Props) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [pending, setPending] = useState<null | 1 | -1>(null);

  async function cast(value: 1 | -1) {
    setPending(value);
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        alert("로그인이 필요합니다.");
        return;
      }
      await api.vote({ target_type, target_id, value }, token);
      value === 1 ? setLikes((n) => n + 1) : setDislikes((n) => n + 1);
    } catch (e) {
      alert(`투표 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => void cast(1)}
        disabled={pending !== null}
        className="rounded-md border px-2 py-1 hover:bg-brand-surface disabled:opacity-50"
      >
        👍 {likes}
      </button>
      <button
        onClick={() => void cast(-1)}
        disabled={pending !== null}
        className="rounded-md border px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
      >
        👎 {dislikes}
      </button>
    </div>
  );
}
