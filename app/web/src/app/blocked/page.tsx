"use client";

import Link from "next/link";
import { useEffect } from "react";

import { getSupabaseBrowser } from "@/lib/supabase";

export default function BlockedPage() {
  useEffect(() => {
    // 차단 계정의 잔존 세션만 정리 — 홈으로 자동 리다이렉트는 하지 않는다.
    // 사용자가 안내 문구를 충분히 본 뒤 아래 버튼으로 직접 이동.
    void getSupabaseBrowser().auth.signOut();
  }, []);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <div className="text-3xl font-bold text-red-600">🚫 이용 정지된 계정</div>
        <p className="mt-3 text-base font-bold text-neutral-700">
          이 계정은 서비스 이용이 정지되어 있습니다.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          문의: 관리자에게 연락해주세요.
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-brand px-6 py-3 font-bold text-brand-fg hover:bg-brand-hover"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
