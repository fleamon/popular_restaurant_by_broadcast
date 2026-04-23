"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const BASE_TABS: Tab[] = [
  { href: "/search", label: "검색" },
  { href: "/vote", label: "투표" },
  { href: "/about", label: "소개" },
];

const ADMIN_TAB: Tab = { href: "/admin", label: "DB 관리" };

export default function NavTabs({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav className="mx-auto max-w-6xl px-4">
      <ul className="flex gap-1 text-sm">
        <li>
          <Link
            href="/"
            className={linkClass(path === "/")}
            aria-current={path === "/" ? "page" : undefined}
          >
            홈
          </Link>
        </li>
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className={linkClass(path?.startsWith(t.href) ?? false)}
              aria-current={path?.startsWith(t.href) ? "page" : undefined}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function linkClass(active: boolean) {
  return [
    "inline-block px-3 py-2 border-b-2 transition-colors",
    active ? "border-brand text-brand font-semibold" : "border-transparent text-neutral-600 hover:text-brand",
  ].join(" ");
}
