import Link from "next/link";

// 홈 하단 슬림 콘텐츠 — '지도 한 장' 컨셉을 해치지 않는 선에서 최소한의 소개 + 빠른 탐색 링크.
// (지역/카테고리 칩은 텍스트 더미가 아니라 클릭 시 바로 필터 검색되는 유용한 내비게이션 =
//  SEO 내부 링크 + AdSense 최소 콘텐츠도 겸함.)

const REGIONS: string[] = [
  "서울특별시", "경기도", "인천광역시", "부산광역시", "대구광역시",
  "대전광역시", "광주광역시", "울산광역시", "강원특별자치도", "제주특별자치도",
];

const CATEGORIES: string[] = [
  "한식", "일식", "중식", "양식", "분식", "카페", "베이커리", "디저트", "아시안", "패스트푸드",
];

export default function HomeIntro() {
  return (
    <section className="mt-8 space-y-5 border-t border-neutral-100 pt-6 text-neutral-700">
      <p className="text-sm leading-relaxed text-neutral-500">
        <strong className="text-neutral-700">백안맛지도</strong>는 TV·유튜브에 소개된 전국 맛집을 지역·카테고리·채널별로
        지도에서 찾아보는 서비스입니다. 아래에서 바로 둘러보세요.
      </p>

      <div className="space-y-1.5">
        <div className="text-xs font-bold text-neutral-400">지역별로 둘러보기</div>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Link
              key={r}
              href={`/?sido=${encodeURIComponent(r)}`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-600 hover:border-brand hover:text-brand"
            >
              {r}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-bold text-neutral-400">카테고리별로 둘러보기</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/?cuisine=${encodeURIComponent(c)}`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-600 hover:border-brand hover:text-brand"
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        <Link href="/about" className="text-brand underline-offset-2 hover:underline">서비스 소개</Link>
        {" · "}
        <Link href="/vote" className="text-brand underline-offset-2 hover:underline">투표·랭킹</Link>
        {" · "}
        <Link href="/request" className="text-brand underline-offset-2 hover:underline">요청 게시판</Link>
      </p>
    </section>
  );
}
