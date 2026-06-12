"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

// AdSense 정책: '게시자 콘텐츠가 없는 화면'(로그인·관리·내페이지·차단 안내 등)에는
// 광고 코드를 두면 안 됨. 콘텐츠 페이지(검색·맛집 상세·투표·요청·소개·약관·방침)에서만 로드.
const NON_CONTENT_PREFIXES = ["/admin", "/auth", "/blocked", "/mypage"];

export default function AdSenseLoader() {
  const pathname = usePathname() ?? "/";
  if (!AD_CLIENT) return null;
  if (NON_CONTENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}
