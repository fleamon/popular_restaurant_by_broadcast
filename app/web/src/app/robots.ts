import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.xn--0z2byb.com";
  return {
    // 콘텐츠 없는 유틸리티 화면(관리/인증/내페이지/차단)은 크롤 제외 — thin content 색인 방지(AdSense 품질).
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/mypage", "/blocked"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
