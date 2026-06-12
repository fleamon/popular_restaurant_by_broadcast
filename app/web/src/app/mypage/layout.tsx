import type { Metadata } from "next";

// 내 페이지 — 로그인 전용·개인화 화면이라 색인 제외.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
