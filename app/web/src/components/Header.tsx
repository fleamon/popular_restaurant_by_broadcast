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
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-neutral-100">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
        {/* 좌: 로고 (마우스오버 시 파랑 로고로 전환) */}
        <Link href="/" aria-label="홈으로" className="group relative h-9 w-36 block">
          <Image
            src="/white_eyes_white.png"
            alt="백안맛지도"
            fill
            priority
            sizes="144px"
            className="object-contain transition-opacity duration-150 group-hover:opacity-0"
          />
          <Image
            src="/white_eyes_blue.png"
            alt=""
            fill
            aria-hidden
            sizes="144px"
            className="object-contain opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </Link>

        {/* 우: 로그인 상태 */}
        <div className="flex items-center gap-3 text-sm">
          {email ? (
            <>
              <span className="text-neutral-600">{email}</span>
              <button
                onClick={() => void signOut()}
                className="rounded-md border px-3 py-1.5 hover:bg-neutral-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-md bg-brand px-3 py-1.5 text-brand-fg hover:bg-brand-hover"
            >
              로그인 / 회원가입
            </Link>
          )}
        </div>
      </div>

      <NavTabs isAdmin={isAdmin} />
    </header>
  );
}
