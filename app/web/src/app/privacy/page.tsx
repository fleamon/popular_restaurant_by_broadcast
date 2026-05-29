import type { Metadata } from "next";

import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 백안맛지도",
  description: "백안맛지도 개인정보처리방침",
};

const UPDATED = "2026년 5월 29일";
const CONTACT = "fleabackx@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <PageHeader
        title="개인정보처리방침"
        subtitle={`최종 수정일: ${UPDATED}`}
      />

      <div className="space-y-6 text-sm leading-relaxed text-neutral-700">

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">1. 개요</h2>
          <p>
            백안맛지도(이하 "서비스")는 방송·유튜브에 소개된 전국 맛집 정보를 제공하는
            개인 운영 웹 서비스입니다. 본 방침은 서비스 이용 과정에서 수집·이용·보관하는
            개인정보와 쿠키에 관한 사항을 안내합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">2. 수집하는 정보</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>
              <strong className="text-neutral-800">회원가입 시</strong>: 이메일 주소, 닉네임,
              암호화된 비밀번호(평문 미보관)
            </li>
            <li>
              <strong className="text-neutral-800">소셜 로그인 시</strong>: 연동한 소셜 계정으로부터
              받는 이메일 주소 및 프로필 정보
            </li>
            <li>
              <strong className="text-neutral-800">서비스 이용 시</strong>: 투표·북마크 기록,
              요청 게시글 내용, 방문 횟수(익명 카운터)
            </li>
            <li>
              <strong className="text-neutral-800">자동 수집</strong>: 광고 및 통계 목적으로
              브라우저 쿠키·로컬스토리지를 통해 익명 식별자가 수집될 수 있습니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">3. 쿠키 및 광고</h2>
          <p>
            이 서비스는 <strong>Google AdSense</strong>를 통해 광고를 제공합니다.
            Google은 광고 게재·맞춤화를 위해 쿠키를 사용하며, 이를 통해 방문 기록이
            익명 통계 형태로 처리될 수 있습니다.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>
              Google의 광고 쿠키 사용 방식:{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline-offset-2 hover:underline"
              >
                Google 광고 정책
              </a>
            </li>
            <li>
              광고 맞춤 설정 해제:{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline-offset-2 hover:underline"
              >
                Google 광고 설정
              </a>
            </li>
            <li>
              브라우저 설정에서 쿠키를 차단할 수 있으나, 일부 기능이 제한될 수 있습니다.
            </li>
          </ul>
          <p>
            또한 카카오 지도 SDK가 지도 표시 목적으로 쿠키를 사용할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">4. 제3자 서비스</h2>
          <p>서비스 운영 과정에서 아래 외부 서비스가 사용됩니다. 각 서비스의 개인정보처리방침이 별도로 적용됩니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>
              <strong className="text-neutral-800">Google AdSense</strong> — 광고 게재(쿠키 사용)
            </li>
            <li>
              <strong className="text-neutral-800">Kakao Maps</strong> — 지도 표시(지도 SDK 로드)
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">5. 정보 보유 및 삭제</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>회원 정보는 서비스 탈퇴 시 즉시 삭제 요청 가능합니다.</li>
            <li>투표·북마크 기록은 계정 삭제 시 함께 삭제됩니다.</li>
            <li>
              삭제 요청은 아래 연락처로 이메일을 보내주시면 7일 이내 처리합니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">6. 이용자 권리</h2>
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>개인정보 열람·정정·삭제 요청</li>
            <li>개인정보 처리 정지 요청</li>
            <li>광고 쿠키 거부(브라우저 설정 또는 Google 광고 설정)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">7. 연락처</h2>
          <p>
            개인정보 관련 문의는 아래 이메일로 연락해 주세요.
          </p>
          <p>
            <a
              href={`mailto:${CONTACT}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {CONTACT}
            </a>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">8. 방침 변경</h2>
          <p>
            본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 이 페이지에
            수정일과 함께 공지합니다.
          </p>
        </section>

      </div>
    </div>
  );
}
