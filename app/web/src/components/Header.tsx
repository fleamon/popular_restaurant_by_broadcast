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
      <div className="flex items-center h-14 pr-2 sm:h-[72px] sm:pr-4">
        {/* 페이지 좌측 끝에 붙은 로고 (호버 시 흰→파랑 전환). 모바일 작게. */}
        <Link
          href="/"
          aria-label="홈으로"
          className="group relative block h-10 w-32 shrink-0 sm:h-[60px] sm:w-60"
        >
          <Image
            src="/white_eyes_white.png"
            alt="백안맛지도"
            fill
            priority
            sizes="(max-width: 640px) 128px, 240px"
            className="object-contain transition-opacity duration-150 group-hover:opacity-0"
          />
          <Image
            src="/white_eyes_blue.png"
            alt=""
            fill
            aria-hidden
            sizes="(max-width: 640px) 128px, 240px"
            className="object-contain opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </Link>

        {/* 로고 우측 탭 — admin/superadmin 이면 'DB 관리' 노출. 모바일 가로 스크롤 가능. */}
        <NavTabs isAdmin={isAdmin(me)} />

        {/* 우측: 로그인 아이콘 또는 로그아웃 */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
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
              className="relative h-9 w-9 rounded-full hover:bg-brand-surface transition-colors sm:h-14 sm:w-14"
            >
              <Image
                src="/icon-login-user-outline.png"
                alt=""
                fill
                sizes="(max-width: 640px) 36px, 56px"
                className="object-contain p-1.5 sm:p-2"
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
