"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updatePassword } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase";

const INPUT_CLS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none";

/** Supabase 비밀번호 재설정 메일 링크가 도착하는 페이지.
 *  메일의 링크에는 access_token 이 hash 로 들어있고, supabase-js 가 자동으로 세션을 setup.
 *  세션 ready 후 새 비밀번호 입력 → updateUser({ password }).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // 세션 ready 감시 — supabase-js 가 hash 의 토큰을 파싱해 세션 setup 한 직후를 잡음.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getSession().then((res: { data: { session: unknown } }) => {
      if (res.data.session) setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDone(null);
    if (pw !== pw2)     { setErr("비밀번호가 일치하지 않습니다."); return; }
    if (pw.length < 6)  { setErr("비밀번호는 6자 이상이어야 합니다."); return; }
    setBusy(true);
    try {
      await updatePassword(pw);
      setDone("✅ 비밀번호가 변경되었습니다. 잠시 후 홈으로 이동합니다.");
      setTimeout(() => { router.push("/"); router.refresh(); }, 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "비밀번호 변경 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="mb-4 text-center font-soft text-2xl font-bold tracking-tight text-brand">
        비밀번호 재설정
      </h1>

      {!ready ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm font-bold text-neutral-500">
          링크 검증 중…
          <p className="mt-2 text-xs font-normal text-neutral-400">
            메일에서 받은 링크로 접속해야 이 페이지가 활성화됩니다. 30분이 지났다면 로그인 화면에서 재설정 메일을 다시 요청해 주세요.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-neutral-700">새 비밀번호 (6자 이상)</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={6}
              className={INPUT_CLS}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-neutral-700">새 비밀번호 확인</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              minLength={6}
              className={INPUT_CLS}
            />
          </label>
          {err  && <p className="text-sm text-red-500">{err}</p>}
          {done && <p className="text-sm font-bold text-brand">{done}</p>}
          <button
            type="submit"
            disabled={busy || !pw || !pw2}
            className="w-full rounded-md bg-brand px-4 py-2.5 font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
      )}
    </div>
  );
}
