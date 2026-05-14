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
    <nav className="flex items-center gap-1 ml-2">
      {tabs.map((t) => {
        const active = isActive(path, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "px-4 py-2 text-2xl font-bold rounded-md transition-colors",
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
