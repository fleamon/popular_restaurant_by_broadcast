import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Appearance, RelatedRestaurant, Restaurant } from "@/lib/api";
import RestaurantDetailClient from "./RestaurantDetailClient";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://xn--0z2byb.com";

// 서버 fetch 헬퍼 — 실패해도 페이지가 죽지 않도록 null 로 흡수. 1시간 ISR 캐시.
async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const r = await getJSON<Restaurant>(`/restaurants/${id}`);
  if (!r?.current_name) {
    return { title: "맛집 상세 · 백안맛지도" };
  }
  const region = r.sigungu ? `${r.sigungu} ` : "";
  const cuisine = r.cuisine ? `${r.cuisine} ` : "";
  const title = `${r.current_name} — ${region}${cuisine}맛집 · 백안맛지도`;
  const description = `${r.current_name}${r.current_address ? `(${r.current_address})` : ""} — 방송·유튜브에 소개된 ${region}${cuisine}맛집. 소개 영상과 지도를 확인하세요.`;
  const url = `${SITE_URL}/restaurants/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title, description, siteName: "백안맛지도" },
    twitter: { card: "summary", title, description },
  };
}

// 서버에서 식당·영상·연관맛집을 모두 가져와 상세 페이지 본문을 SSR 한다.
//   기존엔 본문이 전부 클라이언트 렌더('use client')라 크롤러가 받는 HTML 은 '불러오는 중…' 뿐이었다 →
//   사이트 콘텐츠의 대부분인 상세 페이지가 검색엔진·AdSense 에 빈 페이지로 보였다(저가치 콘텐츠 거절 원인).
//   이제 초기 데이터를 서버에서 채워 HTML 에 실제 콘텐츠가 담기고, 사용자도 로딩 깜빡임 없이 즉시 본문을 본다.
export default async function RestaurantDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [restaurant, apps, related] = await Promise.all([
    getJSON<Restaurant>(`/restaurants/${id}`),
    getJSON<Appearance[]>(`/restaurants/${id}/top-appearances`),
    getJSON<RelatedRestaurant[]>(`/restaurants/${id}/related`),
  ]);

  if (!restaurant?.current_name) notFound();

  return (
    <>
      <RestaurantStructuredData
        restaurant={restaurant}
        apps={apps ?? []}
        url={`${SITE_URL}/restaurants/${id}`}
      />
      <RestaurantDetailClient
        initialRestaurant={restaurant}
        initialApps={apps ?? []}
        initialRelated={related ?? []}
      />
    </>
  );
}

// schema.org Restaurant JSON-LD — 검색엔진·AdSense 에 페이지 주제를 구조화 데이터로 명시.
function RestaurantStructuredData({
  restaurant,
  apps,
  url,
}: {
  restaurant: Restaurant;
  apps: Appearance[];
  url: string;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.current_name,
    url,
    address: restaurant.current_address || undefined,
    servesCuisine: restaurant.cuisine || undefined,
    telephone: restaurant.phone || undefined,
  };
  if (restaurant.lat != null && restaurant.lng != null) {
    data.geo = { "@type": "GeoCoordinates", latitude: restaurant.lat, longitude: restaurant.lng };
  }
  const video = apps.find((a) => a.youtube_video_id);
  if (video?.youtube_video_id) {
    data.subjectOf = {
      "@type": "VideoObject",
      name: video.episode_title || restaurant.current_name,
      embedUrl: `https://www.youtube.com/embed/${video.youtube_video_id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`,
    };
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
