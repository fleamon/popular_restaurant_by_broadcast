import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import Header from "@/components/Header";
import VisitorCounter from "@/components/VisitorCounter";
import "./globals.css";

export const metadata: Metadata = {
  title: "백안맛지도 — 전국 맛집 지도",
  description: "TV·유튜브에 소개된 전국 맛집을 가장 가독성 좋게 보는 지도",
};

export const viewport: Viewport = {
  themeColor: "#2B7FFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <Header />
        {/* Suspense — useSearchParams 등 client hook 이 정적 prerender 시 Suspense boundary 를 요구 (Next 16). */}
        <main className="mx-auto max-w-6xl px-4 py-3">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
        {/* 좌측 하단 fixed 방문자 카운터 — 모든 페이지에 노출 */}
        <VisitorCounter />
      </body>
    </html>
  );
}
