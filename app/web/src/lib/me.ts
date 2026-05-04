"use client";

import { useCallback, useEffect, useState } from "react";

import { api, type MeResponse } from "./api";
import { getSupabaseBrowser } from "./supabase";

const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8시간
const SESSION_KEY = "session_start";

/** 절대 만료 — 8시간 초과 시 로그아웃 + 홈으로 */
async function forceLogoutOnExpiry(): Promise<boolean> {
  const start = localStorage.getItem(SESSION_KEY);
  if (!start) return false;
  if (Date.now() - Number(start) <= SESSION_MAX_MS) return false;
  try {
    await getSupabaseBrowser().auth.signOut();
  } catch {}
  localStorage.removeItem(SESSION_KEY);
  alert("세션이 만료되었습니다. 다시 로그인해주세요.");
  if (typeof window !== "undefined") window.location.href = "/";
  return true;
}

/** 현재 로그인 사용자 — 권한 검증은 첫 1회만, 이후 SIGNED_IN/OUT 에만 반응. */
export function useMe(): { me: MeResponse | null; loading: boolean } {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (await forceLogoutOnExpiry()) return;
    const sb = getSupabaseBrowser();
    setLoading(true);
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setMe(null);
        return;
      }
      // 세션은 있는데 시작시각이 없으면(예: 새 탭/브라우저) 지금부터 카운트
      if (!localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem(SESSION_KEY, String(Date.now()));
      }
      const m = await api.me();
      if (m?.is_blocked && location.pathname !== "/blocked") {
        location.href = "/blocked";
        return;
      }
      setMe(m);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sb = getSupabaseBrowser();

    // SIGNED_IN / SIGNED_OUT 에만 재검사. TOKEN_REFRESHED 는 동일 사용자 → 권한 재체크 불필요.
    const { data: sub } = sb.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") {
        localStorage.setItem(SESSION_KEY, String(Date.now()));
        void refresh();
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem(SESSION_KEY);
        void refresh();
      }
    });

    // 1분 간격 만료 폴링
    const interval = setInterval(() => { void forceLogoutOnExpiry(); }, 60 * 1000);

    return () => {
      sub.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  return { me, loading };
}
