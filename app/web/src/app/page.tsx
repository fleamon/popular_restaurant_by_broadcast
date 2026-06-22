import { Suspense } from "react";

import HomeIntro from "@/components/HomeIntro";
import PopularRestaurants from "@/components/PopularRestaurants";
import HomeSearch from "./HomeSearch";

// 홈은 서버 컴포넌트 — 검색 UI(클라이언트)와 콘텐츠(서버 렌더)를 분리한다.
//   HomeSearch 는 useSearchParams 를 쓰므로 자체 Suspense 경계로 감싸 정적 생성 시 bail-out 을 가둔다.
//   그 덕에 아래 서버 렌더 콘텐츠는 정적 HTML 에 그대로 담긴다(thin content 회피 + 크롤 경로 확보):
//     - PopularRestaurants: 인기 맛집 상세(/restaurants/{id})로 가는 내부 링크 — 크롤러가 상세를 발견·신뢰
//     - HomeIntro: 이용 방법·FAQ·지역/카테고리 링크
//   이전엔 페이지 전체가 'use client' 라 정적 HTML 에 본문이 비어 있었다.
export default function HomePage() {
  return (
    <div>
      <Suspense fallback={<HomeSearchFallback />}>
        <HomeSearch />
      </Suspense>
      <Suspense fallback={null}>
        <PopularRestaurants />
      </Suspense>
      <HomeIntro />
    </div>
  );
}

// 검색 UI(클라이언트)가 하이드레이트되기 전 정적 HTML 에 노출되는 자리표시자.
//   useSearchParams 로 인해 정적 생성 시 HomeSearch 슬롯은 이 fallback 으로 대체된다 →
//   '불러오는 중…' 한 줄 대신 실제 안내 텍스트를 두어 그 영역에도 콘텐츠가 담기게 한다.
function HomeSearchFallback() {
  return (
    <div className="py-6 text-center">
      <h1 className="font-soft text-lg font-bold tracking-tight text-brand sm:text-2xl">맛집 검색</h1>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-neutral-500">
        TV·유튜브에 소개된 전국 맛집을 지역·채널·카테고리로 검색하고 지도에서 찾아보세요.
        지도를 불러오는 동안 아래에서 인기 맛집을 먼저 둘러볼 수 있습니다.
      </p>
    </div>
  );
}
