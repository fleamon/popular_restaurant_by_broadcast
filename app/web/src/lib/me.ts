"use client";

import { useCallback, useEffect, useState } from "react";

import { api, type MeResponse } from "./api";
import { getSupabaseBrowser } from "./supabase";

// ⏱ 세션 절대 만료 시간 — 디버깅 시 1분으로 바꾸려면 아래 한 줄을 1 * 60 * 1000 으로 교체.
const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8시간 (디버그: 1 * 60 * 1000 = 1분)
// const SESSION_MAX_MS = 1 * 60 * 1000; // 디버그용 1분
const SESSION_KEY = "session_start";
const ROLE_KEY = "current_role"; // forceLogoutOnExpiry 가 useMe 의 closure 없이도 role 확인 가능하게 캐싱.
// ⏱ 폴링 간격 — 만료 검사 주기. SESSION_MAX_MS 보다 짧아야 의미 있음.
const POLL_MS = Math.min(60 * 1000, Math.max(5 * 1000, SESSION_MAX_MS / 4));

// 만료 처리 중 재진입 방지 (useMe 가 Header/Admin 등 여러 곳에서 호출되어 alert 가 N번 뜨던 문제 해결)
let _expiring = false;

async function forceLogoutOnExpiry(): Promise<boolean> {
  if (_expiring) return false;
  // superadmin 은 세션 만료 안 함 — 채널 자동 수집 같은 장시간 관리 작업을 보호.
  if (typeof window !== "undefined" && localStorage.getItem(ROLE_KEY) === "superadmin") {
    return false;
  }
  const start = localStorage.getItem(SESSION_KEY);
  if (!start) return false;
  if (Date.now() - Number(start) <= SESSION_MAX_MS) return false;
  _expiring = true;
  try {
    await getSupabaseBrowser().auth.signOut();
  } catch {}
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
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
      // role 캐싱 — forceLogoutOnExpiry 에서 superadmin 우회 검사용
      if (m?.role) localStorage.setItem(ROLE_KEY, m.role);
      else         localStorage.removeItem(ROLE_KEY);
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
        localStorage.removeItem(ROLE_KEY);
        void refresh();
      }
    });

    // 만료 폴링 — POLL_MS 간격 (SESSION_MAX_MS 에 비례, 최소 5초·최대 1분)
    const interval = setInterval(() => { void forceLogoutOnExpiry(); }, POLL_MS);

    return () => {
      sub.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  return { me, loading };
}
