"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from "@/lib/auth";
import { GoogleLogo, KakaoLogo, NaverLogo } from "@/components/SocialLogos";

type Mode = "login" | "signup";

const INPUT_CLS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-6 flex justify-center gap-2 text-base font-bold">
        <TabBtn active={mode === "login"} onClick={() => setMode("login")}>
          로그인
        </TabBtn>
        <TabBtn active={mode === "signup"} onClick={() => setMode("signup")}>
          회원가입
        </TabBtn>
      </div>

      {mode === "login" ? <LoginForm /> : <SignupForm />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-2 rounded-md transition-colors",
        active ? "bg-brand text-brand-fg" : "text-brand hover:bg-brand-surface",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 로그인 폼 (이메일 + 비밀번호) + 소셜 로그인
// ─────────────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await signInWithEmail(email, password);
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={INPUT_CLS}
          />
        </Field>
        <Field label="비밀번호">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={INPUT_CLS}
          />
        </Field>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand px-4 py-2.5 font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className="relative text-center text-xs text-neutral-400">
        <span className="bg-white px-2">또는 소셜 로그인</span>
        <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-neutral-200" />
      </div>

      <div className="flex flex-col gap-2">
        <SocialBtn onClick={() => void signInWithProvider("kakao")} className="bg-[#FEE500] text-black">
          <KakaoLogo />
          <span>카카오로 로그인</span>
        </SocialBtn>
        <SocialBtn onClick={() => void signInWithProvider("naver")} className="bg-[#03C75A] text-white">
          <NaverLogo />
          <span>네이버로 로그인</span>
        </SocialBtn>
        <SocialBtn onClick={() => void signInWithProvider("google")} className="border border-neutral-300 bg-white text-neutral-800">
          <GoogleLogo />
          <span>구글로 로그인</span>
        </SocialBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 회원가입 폼 (닉네임 / 이메일 / 비밀번호 / 비밀번호 확인)
// — 이메일이 곧 로그인 ID. 별도 username 없음.
// ─────────────────────────────────────────────────────────────────────
function SignupForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDone(null);

    if (password !== password2) {
      setErr("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setErr("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setBusy(true);
    try {
      await signUpWithEmail({ email, password, nickname });
      setDone("회원가입 완료! 메일을 확인해 인증 후 로그인해주세요.");
      setTimeout(() => router.push("/"), 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "회원가입 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
      <Field label="닉네임" required>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} required className={INPUT_CLS} />
      </Field>
      <Field label="이메일" required hint="로그인 ID 로 사용됩니다">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT_CLS} />
      </Field>
      <Field label="비밀번호" required hint="6자 이상">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className={INPUT_CLS}
        />
      </Field>
      <Field label="비밀번호 확인" required>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
          minLength={6}
          className={INPUT_CLS}
        />
      </Field>

      {err && <p className="text-sm text-red-500">{err}</p>}
      {done && <p className="text-sm text-brand">{done}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand px-4 py-2.5 font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "처리 중…" : "회원가입"}
      </button>

      <p className="pt-1 text-xs text-neutral-400">
        비밀번호는 관리자도 알 수 없게 안전하게 저장합니다.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 공통 소형 컴포넌트
// ─────────────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm font-bold text-neutral-700">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {hint && <span className="font-normal text-neutral-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SocialBtn({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-md px-4 py-3 font-bold hover:opacity-90 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
