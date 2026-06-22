import Link from "next/link";

import type { Restaurant } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// 홈에 서버 렌더되는 '인기 맛집' 목록.
//  목적 2가지:
//   1) 크롤 경로 — 홈(진입점)의 서버 HTML 에 개별 맛집 상세(/restaurants/{id})로 가는 내부 링크를 만든다.
//      sitemap 만으로 발견된 페이지보다, 내부 링크로 도달 가능한 페이지를 검색엔진/AdSense 가 더 신뢰한다.
//   2) 콘텐츠 — 홈 자체에 실제 맛집명·지역·카테고리 텍스트가 담겨 'thin' 평가를 피한다.
//  좋아요 순 상위 N개. API 가 꺼져 있으면(콜드스타트 등) 조용히 숨김 → 홈은 항상 정상 렌더.
async function fetchPopular(limit: number): Promise<Restaurant[]> {
  try {
    // 타임아웃 필수 — 빌드 시 Render API 가 콜드스타트/재배포 중이면 fetch 가 60s+ 멈춰 정적 생성이 실패한다.
    // 10s 안에 응답 없으면 포기 → 빈 목록(섹션 숨김). 운영 ISR(1h) 이 다음 재생성 때 채운다.
    const res = await fetch(`${BASE}/restaurants/top?limit=${limit}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Restaurant[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export default async function PopularRestaurants({ limit = 40 }: { limit?: number }) {
  const rows = await fetchPopular(limit);
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 space-y-3 border-t border-neutral-100 pt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-soft text-base font-bold tracking-tight text-brand">인기 맛집</h2>
        <span className="text-xs text-neutral-400">방송·유튜브에 소개된 맛집을 좋아요 순으로</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const region = [r.sido, r.sigungu].filter(Boolean).join(" ");
          return (
            <li key={r.id}>
              <Link
                href={`/restaurants/${r.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-brand hover:bg-brand-surface"
              >
                <div className="font-soft truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                  {r.current_name}
                </div>
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  {region || r.current_address}
                  {r.cuisine ? ` · ${r.cuisine}` : ""}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-neutral-400">
        더 많은 맛집은 위 지도·검색에서 지역과 카테고리로 찾아볼 수 있습니다.
      </p>
    </section>
  );
}
