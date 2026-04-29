"use client";

import { useEffect, useState } from "react";

import { api, type MeResponse } from "./api";
import { getSupabaseBrowser } from "./supabase";

/** 현재 로그인 사용자(public.users row) 를 한 번 가져와 반환. 차단 사용자면 /blocked 로 redirect. */
export function useMe(): { me: MeResponse | null; loading: boolean } {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) {
        if (!cancelled) {
          setMe(null);
          setLoading(false);
        }
        return;
      }
      api.me()
        .then((data) => {
          if (cancelled) return;
          if (data?.is_blocked && location.pathname !== "/blocked") {
            location.href = "/blocked";
            return;
          }
          setMe(data);
        })
        .catch(() => setMe(null))
        .finally(() => !cancelled && setLoading(false));
    });
    return () => { cancelled = true; };
  }, []);

  return { me, loading };
}
