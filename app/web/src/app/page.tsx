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
      <Suspense fallback={<div className="py-10 text-center text-sm text-neutral-400">불러오는 중…</div>}>
        <HomeSearch />
      </Suspense>
      <Suspense fallback={null}>
        <PopularRestaurants />
      </Suspense>
      <HomeIntro />
    </div>
  );
}
