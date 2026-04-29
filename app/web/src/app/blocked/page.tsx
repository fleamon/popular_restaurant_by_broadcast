"use client";

import { useEffect } from "react";

import { signOut } from "@/lib/auth";

export default function BlockedPage() {
  useEffect(() => {
    // 블록된 계정은 즉시 로그아웃 (잔존 세션 정리)
    void signOut();
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
    </div>
  );
}
