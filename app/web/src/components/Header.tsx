"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import NavTabs from "./NavTabs";

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      if (!user) return;
      const { data: profile } = await sb
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      setIsAdmin(!!profile?.is_admin);
    });
  }, []);

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

        {/* 로고 우측에 이어지는 탭 */}
        <NavTabs isAdmin={isAdmin} />

        {/* 우측: 로그인 아이콘 / 로그인된 경우 로그아웃 */}
        <div className="ml-auto flex items-center gap-3">
          {email ? (
            <button
              onClick={() => void signOut()}
              className="text-base font-bold text-neutral-700 hover:text-brand"
              title={email}
            >
              로그아웃
            </button>
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
