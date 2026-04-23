"use client";

import { signInWithProvider } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <h1 className="text-center text-2xl font-bold text-brand">로그인 / 회원가입</h1>
      <p className="text-center text-sm text-neutral-500">
        소셜 계정으로 간편하게 가입하고 맛집에 투표하세요.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => void signInWithProvider("kakao")}
          className="rounded-md bg-[#FEE500] px-4 py-3 font-medium text-black hover:opacity-90"
        >
          🟡 카카오 계정으로 로그인
        </button>
        <button
          onClick={() => void signInWithProvider("naver")}
          className="rounded-md bg-[#03C75A] px-4 py-3 font-medium text-white hover:opacity-90"
        >
          🟢 네이버 아이디로 로그인
        </button>
        <button
          onClick={() => void signInWithProvider("google")}
          className="rounded-md border border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-800 hover:bg-neutral-50"
        >
          🔵 구글 계정으로 로그인
        </button>
      </div>
      <p className="text-center text-xs text-neutral-400">
        실제 로그인 동작은 Supabase Dashboard 에서 각 Provider 를 활성화한 뒤에 가능합니다.
      </p>
    </div>
  );
}
