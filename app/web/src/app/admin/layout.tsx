import type { Metadata } from "next";

// 관리 화면 — 검색엔진 색인 제외(콘텐츠 없는 유틸리티 화면, AdSense 품질).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
