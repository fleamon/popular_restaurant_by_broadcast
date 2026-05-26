"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/me";
import { isAdmin } from "@/lib/role";
import NavTabs from "./NavTabs";

export default function Header() {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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

        {/* 우측: 로그인 아이콘 (로그인 시 클릭하면 드롭다운) */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {me ? (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="계정 메뉴"
                aria-expanded={open}
                className="relative h-9 w-9 rounded-full hover:bg-brand-surface transition-colors sm:h-14 sm:w-14"
              >
                <Image
                  src="/icon-login-user-outline.png"
                  alt=""
                  fill
                  sizes="(max-width: 640px) 36px, 56px"
                  className="object-contain p-1.5 sm:p-2"
                />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-neutral-200 bg-white shadow-lg z-50 py-1 overflow-hidden">
                  <div className="border-b border-neutral-100 px-4 py-2.5">
                    <p className="truncate text-xs font-bold text-neutral-500">
                      {me.nickname ?? me.email}
                    </p>
                    {me.role !== "user" && (
                      <span className="mt-0.5 inline-block rounded bg-brand-surface px-1.5 py-0.5 text-[10px] font-bold text-brand">
                        {me.role}
                      </span>
                    )}
                  </div>
                  <Link
                    href="/mypage"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-brand-surface hover:text-brand"
                  >
                    <UserIcon className="h-4 w-4" />
                    마이페이지
                  </Link>
                  <button
                    onClick={() => { setOpen(false); void signOut(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-brand-surface hover:text-brand"
                  >
                    <LogoutIcon className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
