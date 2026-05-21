import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";

import Header from "@/components/Header";
import VisitorCounter from "@/components/VisitorCounter";
import "./globals.css";

// Google AdSense — NEXT_PUBLIC_ADSENSE_CLIENT 가 채워졌을 때만 스크립트/메타 노출.
// 검수 단계: 스크립트만 박혀있어도 Google 이 사이트 확인 가능.
// 검수 통과 후: 페이지에 <AdSlot slot="..." /> 로 광고 단위 배치.
const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export const metadata: Metadata = {
  title: "백안맛지도 — 전국 맛집 지도",
  description: "TV·유튜브에 소개된 전국 맛집을 가장 가독성 좋게 보는 지도",
  ...(AD_CLIENT && {
    other: {
      // AdSense 일부 검수 케이스에서 페이지 head 의 인증 메타 요구
      "google-adsense-account": AD_CLIENT,
    },
  }),
};

export const viewport: Viewport = {
  themeColor: "#2B7FFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {/* AdSense loader — env 가 비어있으면 렌더되지 않음. afterInteractive 로 CLS 영향 최소화 */}
        {AD_CLIENT && (
          <Script
            id="adsense-loader"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
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
