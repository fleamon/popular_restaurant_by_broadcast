import type { Metadata } from "next";

import RestaurantDetailClient from "./RestaurantDetailClient";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.xn--0z2byb.com";

type RestaurantMeta = {
  current_name?: string;
  current_address?: string;
  cuisine?: string | null;
  sigungu?: string | null;
};

// 서버에서 식당 정보를 가져와 가게별 동적 메타데이터 생성 — SEO·공유 카드·AdSense 콘텐츠 강화.
// (상호작용 UI 는 RestaurantDetailClient 가 담당. 이 파일은 메타데이터만.)
async function fetchRestaurant(id: string): Promise<RestaurantMeta | null> {
  try {
    const res = await fetch(`${BASE}/restaurants/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as RestaurantMeta | null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const r = await fetchRestaurant(id);
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

export default function RestaurantDetailPage() {
  return <RestaurantDetailClient />;
}
