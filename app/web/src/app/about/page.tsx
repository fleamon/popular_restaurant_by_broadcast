import Link from "next/link";

import DonationSection from "@/components/DonationSection";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "소개 · 백안맛지도" };

// 주요 기능 카드 — 여기 배열을 수정하면 페이지의 카드 그리드가 자동으로 갱신됨.
const FEATURES: { title: string; desc: string }[] = [
  {
    title: "지도 기반 한눈에 보기",
    desc: "전국 방송·유튜브에 소개된 맛집을 카카오 지도 핀으로. 화면 영역 안의 식당만 그려져 빠르고 가독성 좋습니다.",
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
    desc: "한 아이디는 하루에 맛집·채널·영상 각 1회씩 좋아요/싫어요 가능. 투표 탭에서 세 가지 랭킹·인기 급상승 영상·기간별 비교합니다.",
  },
  {
    title: "공유 가능한 검색 결과",
    desc: "필터링한 결과 URL 을 카카오톡으로 공유. '오늘 종로에서 만날 친구한테' 한 장의 링크로 전달합니다.",
  },
  {
    title: "요청 게시판",
    desc: "채널 추가요청 / 관리자 요청 / 버그 제보 / 기타 요청. 작성자와 관리자가 답변형 대화로 처리. 공지사항은 누구나 열람 가능합니다.",
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
            지도 한 장으로 훑어보고, 좋아요/싫어요로 랭킹을 만드는 프로젝트 입니다.
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
    </div>
  );
}
