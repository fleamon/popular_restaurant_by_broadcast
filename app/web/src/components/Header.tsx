"use client";

import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/me";
import { isAdmin } from "@/lib/role";
import NavTabs from "./NavTabs";

export default function Header() {
  const { me } = useMe();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
      <div className="flex items-center h-[72px] pr-4">
        {/* 페이지 좌측 끝에 붙은 로고 (호버 시 흰→파랑 전환) */}
        <Link
          href="/"
          aria-label="홈으로"
          className="group relative block h-[60px] w-60 shrink-0"
        >
          <Image
            src="/white_eyes_white.png"
            alt="백안맛지도"
            fill
            priority
            sizes="240px"
            className="object-contain transition-opacity duration-150 group-hover:opacity-0"
          />
          <Image
            src="/white_eyes_blue.png"
            alt=""
            fill
            aria-hidden
            sizes="240px"
            className="object-contain opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </Link>

        {/* 로고 우측 탭 — admin/superadmin 이면 'DB 관리' 노출 */}
        <NavTabs isAdmin={isAdmin(me)} />

        {/* 우측: 로그인 아이콘 또는 로그아웃 */}
        <div className="ml-auto flex items-center gap-3">
          {me ? (
            <>
              <span className="hidden sm:inline text-sm font-bold text-neutral-700">
                {me.nickname ?? me.email}
                {me.role !== "user" && (
                  <span className="ml-2 rounded bg-brand-surface px-1.5 py-0.5 text-xs text-brand">
                    {me.role}
                  </span>
                )}
              </span>
              <button
                onClick={() => void signOut()}
                className="text-sm font-bold text-neutral-700 hover:text-brand"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              aria-label="로그인 / 회원가입"
              title="로그인 / 회원가입"
              className="relative h-14 w-14 rounded-full hover:bg-brand-surface transition-colors"
            >
              <Image
                src="/icon-login-user-outline.png"
                alt=""
                fill
                sizes="56px"
                className="object-contain p-2"
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
