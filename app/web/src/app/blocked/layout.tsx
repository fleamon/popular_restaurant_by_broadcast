import type { Metadata } from "next";

// 차단 안내 — 색인 제외.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BlockedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
