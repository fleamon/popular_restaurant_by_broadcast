"use client";

import { useCallback, useEffect, useState } from "react";

import { api, type MeResponse } from "./api";
import { getSupabaseBrowser } from "./supabase";

/** 현재 로그인 사용자(public.users row). 로그인/로그아웃 이벤트에 즉시 반응. */
export function useMe(): { me: MeResponse | null; loading: boolean } {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = getSupabaseBrowser();
    setLoading(true);
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setMe(null);
        return;
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
    // 로그인/로그아웃/토큰갱신 이벤트에 자동 동기화 — 이게 없으면 새로고침해야 헤더 갱신.
    const sb = getSupabaseBrowser();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        void refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { me, loading };
}
