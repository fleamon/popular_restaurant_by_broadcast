import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.xn--0z2byb.com";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// 1시간마다 재생성 — 새 맛집이 등록되면 sitemap 에 반영(크롤러 발견성).
export const revalidate = 3600;

type SitemapRow = { id: number; updated_at?: string | null };

// 맛집 상세 페이지(/restaurants/{id})가 사이트 콘텐츠의 대부분 —
// 정적 6페이지만 sitemap 에 있으면 '빈약한 사이트' 로 평가된다(AdSense 저가치 거절 원인).
// 백엔드 경량 엔드포인트에서 모든 맛집 id+갱신시각을 받아 동적으로 포함한다.
async function fetchRestaurantEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    // 타임아웃 — 빌드 시 API 가 콜드스타트/재배포 중이어도 sitemap 생성이 멈추지 않도록.
    // 응답 없으면 정적 페이지 sitemap 만 반환, ISR(1h)이 다음 재생성 때 상세 URL 을 채운다.
    const res = await fetch(`${API}/restaurants/sitemap`, {
      next: { revalidate },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as SitemapRow[];
    return rows.map((r) => ({
      url: `${SITE}/restaurants/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // API 다운/콜드스타트여도 정적 페이지 sitemap 은 항상 반환되도록.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE,              changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE}/vote`,    changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE}/about`,   changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/request`, changeFrequency: "weekly",  priority: 0.5 },
    { url: `${SITE}/terms`,   changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];
  const restaurants = await fetchRestaurantEntries();
  return [...staticPages, ...restaurants];
}
