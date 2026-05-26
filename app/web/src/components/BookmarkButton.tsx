"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { getSupabaseBrowser } from "@/lib/supabase";

type Props = {
  target_type: "restaurant" | "channel" | "appearance";
  target_id: number;
  initialBookmarked?: boolean;
  onChange?: (id: number, bookmarked: boolean) => void;
  size?: "sm" | "md";
};

export default function BookmarkButton({
  target_type,
  target_id,
  initialBookmarked = false,
  onChange,
  size = "md",
}: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setBookmarked(initialBookmarked); }, [initialBookmarked]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.getSession();
      if (!data.session?.access_token) { alert("로그인이 필요합니다."); return; }
      if (bookmarked) {
        await api.removeBookmark(target_type, target_id);
      } else {
        await api.addBookmark(target_type, target_id);
      }
      const next = !bookmarked;
      setBookmarked(next);
      onChange?.(target_id, next);
    } catch (e) {
      alert(`북마크 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const pad = size === "sm" ? "p-1.5" : "p-2";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={bookmarked ? "북마크 해제" : "북마크 추가"}
      title={bookmarked ? "북마크 해제" : "북마크 추가"}
      className={[
        "flex items-center justify-center rounded-md transition-colors",
        pad,
        bookmarked ? "text-brand" : "text-neutral-300 hover:text-brand",
        busy ? "opacity-50" : "",
      ].join(" ")}
    >
      <BookmarkIcon filled={bookmarked} className={iconSize} />
    </button>
  );
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
