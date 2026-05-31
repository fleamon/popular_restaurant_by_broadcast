import Link from "next/link";

import DonationSection from "@/components/DonationSection";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "소개 · 백안맛지도" };

// 주요 기능 카드 — 여기 배열을 수정하면 페이지의 카드 그리드가 자동으로 갱신됨.
const FEATURES: { title: string; desc: string }[] = [
  {
    title: "지도 기반 한눈에 보기",
    desc: "전국 방송·유튜브에 소개된 맛집을 카카오 지도 핀으로. 화면 영역 안의 식당만 그려져 빠르고 가독성 좋습니다. 지도 우하단 버튼으로 현재 위치를 기준으로 주변 맛집을 바로 확인할 수 있습니다.",
  },
  {
    title: "다층 필터링",
    desc: "채널 타입 / 채널명 / 시도 → 시·군·구 → 동 / 카테고리 / 식당 이름. 필터 상태는 URL 에 기록되어 링크 한 장으로 공유 가능합니다.",
  },
  {
    title: "지도 / 목록 / 격자 세 가지 보기",
    desc: "지도 모드는 현재화면기반, 목록·격자는 좋아요 순 정렬 + 페이지네이션. 상황에 맞는 보기 방식 선택합니다.",
  },
  {
    title: "맛집 / 채널 / 영상 투표",
    desc: "한 아이디는 하루에 한 번 맛집·채널·영상 각 1회씩 좋아요 가능. 투표 탭에서 세 가지 랭킹·인기 급상승 영상·기간별 비교합니다.",
  },
  {
    title: "공유 가능한 검색 결과",
    desc: "필터링한 결과 URL 을 카카오톡으로 공유. '오늘 종로에서 만날 친구한테' 한 장의 링크로 전달합니다.",
  },
  {
    title: "요청 게시판",
    desc: "채널 추가요청 / 관리자 요청 / 버그 제보 / 기타 요청. 작성자와 관리자가 답변형 대화로 처리. 공지사항은 누구나 열람 가능합니다.",
  },
  {
    title: "마이페이지",
    desc: "로그인 후 내가 투표한 맛집·채널·영상 내역과 좋아요 집계를 확인합니다. 북마크 기능으로 관심 있는 맛집·채널·영상을 저장하고 한눈에 모아볼 수 있습니다.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="백안맛지도란?"
        subtitle={
          <>
            TV · YouTube · 블로그에 소개된{" "}
            <Link href="/" className="text-brand underline-offset-2 hover:underline">전국 맛집</Link> 을
            지도 한 장으로 훑어보고, 좋아요로 랭킹을 만드는 프로젝트 입니다.
            <br></br>{" "}<strong>사용자와 함께 만들어가요</strong> — 채널 추가·버그 제보·아이디어는{" "}
            <Link href="/request" className="text-brand underline-offset-2 hover:underline">요청 탭</Link> 으로 보내주세요.
          </>
        }
      />

      {/* 주요 기능 — 카드 텍스트는 이 파일 상단의 FEATURES 배열에서 수정 */}
      <section className="space-y-3">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">주요 기능</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand"
            >
              <div className="font-soft text-sm font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>
                {f.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{f.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <DonationSection />
      <AdNotice />
    </div>
  );
}

// 광고 안내 — 광고 운영 시 정책상 필요한 명시 문구.
//   • Google AdSense: 광고 쿠키 / 개인정보 사용 안내 (개인정보처리방침 권장)
//   • 카카오 애드핏: 광고 영역 표기
//   • 쿠팡 파트너스: "쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다" 명시 필수
// 광고 env 가 하나라도 채워졌을 때만 노출 — 도입 전 단계엔 안 보임.
function AdNotice() {
  const hasAdSense = !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const hasAdFit   = !!process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT;
  const hasCoupang = !!(process.env.NEXT_PUBLIC_COUPANG_WIDGET_ID && process.env.NEXT_PUBLIC_COUPANG_TRACKING);
  if (!hasAdSense && !hasAdFit && !hasCoupang) return null;

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
      <h3 className="mb-2 font-soft text-sm font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>
        광고 안내
      </h3>
      <ul className="space-y-1.5">
        {hasAdSense && (
          <li>
            이 사이트는 사이트 운영 비용 충당을 위해{" "}
            <strong className="text-neutral-800">Google AdSense</strong> 광고를 노출합니다. 광고 게재 과정에서 쿠키를
            사용해 방문 기록을 익명 통계화할 수 있으며, 자세한 내용은 Google 의{" "}
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
              광고 정책
            </a>
            을 참고하세요.
          </li>
        )}
        {hasAdFit && (
          <li>
            <strong className="text-neutral-800">카카오 애드핏</strong> 광고가 일부 영역에 노출될 수 있으며, 광고
            영역에는 "AD" 또는 광고 표시가 함께 표기됩니다.
          </li>
        )}
        {hasCoupang && (
          <li>
            <strong className="text-neutral-800">쿠팡 파트너스 활동의 일환으로</strong>, 본 사이트의 일부 링크/위젯을
            통한 구매 발생 시 이에 따른 일정액의 수수료를 제공받습니다.
          </li>
        )}
        <li className="pt-1 text-neutral-500">
          광고는 사용자 경험을 해치지 않도록 최소한으로 배치하며, 관리자/로그인 페이지에는 노출하지 않습니다.
        </li>
      </ul>
    </section>
  );
}
