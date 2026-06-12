import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import AdSenseLoader from "@/components/AdSenseLoader";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import VisitorCounter from "@/components/VisitorCounter";
import "./globals.css";

// Google AdSense — NEXT_PUBLIC_ADSENSE_CLIENT 가 채워졌을 때만 스크립트/메타 노출.
// 검수 단계: 스크립트만 박혀있어도 Google 이 사이트 확인 가능.
// 검수 통과 후: 페이지에 <AdSlot slot="..." /> 로 광고 단위 배치.
const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.xn--0z2byb.com";
const SITE_IMAGE = `${SITE_URL}/white_eyes_blue.png`;

export const metadata: Metadata = {
  title: "백안맛지도 — 전국 맛집 지도",
  description: "TV·유튜브에 소개된 전국 맛집을 가장 가독성 좋게 보는 지도",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    // og:url 은 의도적으로 비움 — 정적으로 루트를 박으면 카카오 공유 시 쿼리스트링이 붙은
    // 실제 공유 URL 대신 og:url(루트)로 열려 필터 파라미터가 사라진다. 페이지가 모두
    // client component 라 per-page 메타를 못 넣으므로, og:url 을 생략해 카카오가
    // sendDefault 의 link.webUrl(현재 URL+파라미터)을 그대로 쓰게 한다.
    siteName: "백안맛지도",
    title: "백안맛지도 — 전국 맛집 지도",
    description: "TV·유튜브에 소개된 전국 맛집을 가장 가독성 좋게 보는 지도",
    images: [{ url: SITE_IMAGE, width: 800, height: 400, alt: "백안맛지도" }],
  },
  twitter: {
    card: "summary",
    title: "백안맛지도 — 전국 맛집 지도",
    description: "TV·유튜브에 소개된 전국 맛집을 가장 가독성 좋게 보는 지도",
    images: [SITE_IMAGE],
  },
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
        {/* AdSense loader — 콘텐츠 페이지에서만 로드(admin/login/mypage/blocked 제외). env 비면 미렌더. */}
        <AdSenseLoader />
        <Header />
        {/* Suspense — useSearchParams 등 client hook 이 정적 prerender 시 Suspense boundary 를 요구 (Next 16). */}
        <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-3">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
        <Footer />
        {/* 좌측 하단 fixed 방문자 카운터 — 모든 페이지에 노출 */}
        <VisitorCounter />
      </body>
    </html>
  );
}
