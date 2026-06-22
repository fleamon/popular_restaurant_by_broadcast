import Link from "next/link";

// 홈 하단 콘텐츠 — 서버 렌더(크롤러가 받는 초기 HTML 에 포함)되는 원문 텍스트.
//  지역/카테고리 칩은 클릭 시 바로 필터 검색되는 내부 링크(SEO·탐색)이고,
//  이용 방법·자주 묻는 질문은 사이트의 고유 콘텐츠를 보강해 'thin content' 평가를 막는다(AdSense 최소 콘텐츠 요건).

const REGIONS: string[] = [
  "서울특별시", "경기도", "인천광역시", "부산광역시", "대구광역시",
  "대전광역시", "광주광역시", "울산광역시", "강원특별자치도", "제주특별자치도",
];

const CATEGORIES: string[] = [
  "한식", "일식", "중식", "양식", "분식", "카페", "베이커리", "디저트", "아시안", "패스트푸드",
];

const STEPS: { title: string; desc: string }[] = [
  {
    title: "1. 지역·채널·카테고리로 좁히기",
    desc: "시·도 → 시·군·구 → 동, 방송 채널명, 음식 카테고리를 골라 원하는 맛집만 추립니다. 식당 이름을 직접 검색할 수도 있습니다.",
  },
  {
    title: "2. 지도·목록·격자로 살펴보기",
    desc: "지도 모드는 화면에 보이는 영역의 식당만 핀으로 그려 빠르고, 목록·격자 모드는 좋아요 순으로 정렬해 인기 맛집을 한눈에 보여줍니다.",
  },
  {
    title: "3. 소개 영상과 위치 확인하기",
    desc: "맛집을 누르면 어떤 방송·유튜브에 소개됐는지 원본 영상과 함께, 주소·전화·지도, 네이버·카카오 지도 길찾기 링크를 제공합니다.",
  },
  {
    title: "4. 좋아요로 랭킹 만들기",
    desc: "마음에 드는 맛집·채널·영상에 하루 한 번 좋아요를 누르면 모두가 함께 만드는 랭킹에 반영됩니다.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "백안맛지도는 어떤 서비스인가요?",
    a: "TV·유튜브 등 방송에 소개된 전국 맛집을 지도 한 장에서 지역·채널·카테고리별로 찾아보는 무료 서비스입니다. 식당마다 어떤 방송에 나왔는지 원본 영상과 위치를 함께 보여줍니다.",
  },
  {
    q: "맛집 정보는 어디서 가져오나요?",
    a: "YouTube 공식 데이터 API 와 지도 서비스의 공식 API 만 사용합니다. 영상은 유튜브 공식 임베드 플레이어로 재생하고 원본 채널 출처를 함께 표기하며, 네이버·카카오 지도는 링크로 연결만 합니다.",
  },
  {
    q: "이용에 회원가입이 꼭 필요한가요?",
    a: "맛집 검색과 지도 탐색, 영상 보기는 회원가입 없이 누구나 자유롭게 이용할 수 있습니다. 좋아요 투표와 북마크 저장 같은 개인화 기능만 로그인이 필요합니다.",
  },
  {
    q: "좋아요(투표)는 어떻게 동작하나요?",
    a: "한 계정은 하루(한국 시간 자정 기준)에 맛집·채널·영상 각각 한 번씩 좋아요를 누를 수 있습니다. 매일 한 표씩 쌓여 랭킹이 만들어지며, 투표 탭에서 기간별 랭킹과 인기 급상승 영상을 확인할 수 있습니다.",
  },
  {
    q: "정보가 틀렸거나 폐업한 가게는 어떻게 하나요?",
    a: "요청 게시판에서 정정·삭제를 요청하실 수 있습니다. 가게 관계자의 정정 요청도 같은 창구로 받고 있습니다.",
  },
];

export default function HomeIntro() {
  return (
    <section className="mt-8 space-y-7 border-t border-neutral-100 pt-6 text-neutral-700">
      <div className="space-y-2">
        <h2 className="font-soft text-lg font-bold tracking-tight text-brand">방송 맛집을 지도 한 장으로</h2>
        <p className="text-sm leading-relaxed text-neutral-500">
          <strong className="text-neutral-700">백안맛지도</strong>는 TV·유튜브에 소개된 전국 맛집을 지역·카테고리·채널별로
          지도에서 찾아보는 서비스입니다. 어떤 방송에 나온 맛집인지 원본 영상과 위치를 함께 확인하고, 좋아요로 나만의
          랭킹을 만들어 보세요. 아래에서 바로 둘러볼 수 있습니다.
        </p>
      </div>

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

      <div className="space-y-3">
        <h2 className="font-soft text-base font-bold tracking-tight text-brand">이용 방법</h2>
        <ol className="grid gap-2.5 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <div className="text-sm font-bold text-neutral-800">{s.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <h2 className="font-soft text-base font-bold tracking-tight text-brand">자주 묻는 질문</h2>
        <dl className="space-y-3">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <dt className="text-sm font-bold text-neutral-800">{f.q}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-neutral-500">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-xs text-neutral-400">
        더 알아보기:{" "}
        <Link href="/about" className="text-brand underline-offset-2 hover:underline">서비스 소개</Link>
        {" · "}
        <Link href="/vote" className="text-brand underline-offset-2 hover:underline">투표·랭킹</Link>
        {" · "}
        <Link href="/request" className="text-brand underline-offset-2 hover:underline">요청 게시판</Link>
      </p>

      {/* FAQ 구조화 데이터 — 검색결과 리치 스니펫 + 콘텐츠 품질 신호 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </section>
  );
}
