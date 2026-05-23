"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: Route; label: string };

// '검색' 탭이 홈("/") 화면을 겸한다.
const BASE_TABS: Tab[] = [
  { href: "/", label: "검색" },
  { href: "/vote", label: "투표" },
  { href: "/request", label: "요청" },
  { href: "/about", label: "소개" },
];

const ADMIN_TAB: Tab = { href: "/admin", label: "DB 관리" };

export default function NavTabs({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    // 모바일: 좁은 폭이라 가로 스크롤 + 작은 폰트 / 데스크탑: 기존 큼지막한 탭
    <nav className="ml-1 flex flex-1 min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:ml-2 sm:gap-1">
      {tabs.map((t) => {
        const active = isActive(path, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 whitespace-nowrap rounded-md font-bold transition-colors",
              "px-2 py-1.5 text-base sm:px-4 sm:py-2 sm:text-2xl",
              "text-brand hover:bg-brand-surface",
              active ? "bg-brand-surface" : "",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(path: string | null, href: string): boolean {
  if (!path) return false;
  if (href === "/") return path === "/";
  return path.startsWith(href);
}
