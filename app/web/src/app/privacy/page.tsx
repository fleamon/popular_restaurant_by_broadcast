import type { Metadata } from "next";

import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "개인정보처리방침 · 백안맛지도",
  description: "백안맛지도 개인정보처리방침",
};

const UPDATED = "2026년 6월 1일";
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

        <section className="space-y-2 rounded-xl border border-brand bg-brand-surface p-4">
          <h2 className="font-bold text-brand">개인정보 보호 원칙 (요약)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-700">
            <li>
              <strong>최소 수집</strong> — 서비스 제공(로그인)에 꼭 필요한 정보(이메일·닉네임)만 받습니다.
              이름·전화번호·주민등록번호·정확한 위치 등은 수집하지 않습니다.
            </li>
            <li>
              <strong>판매·공개 안 함</strong> — 수집한 개인정보를 외부에 판매하거나 제3자에게 공개하지 않으며,
              서비스 운영 목적 외로 이용하지 않습니다.
            </li>
            <li>
              <strong>방문 통계는 익명</strong> — 방문자 수 집계는 개인을 식별할 수 없는 <strong>임의의 익명 식별자</strong>만
              사용합니다. IP·계정과 연결되지 않으므로 <strong>개인정보에 해당하지 않습니다.</strong>
            </li>
            <li>
              <strong>위치정보 미저장</strong> — '현재 위치'는 내 브라우저 안에서만 사용되며 서버로 전송·저장되지 않습니다.
            </li>
            <li>
              <strong>언제든 삭제</strong> — 회원 탈퇴 시 내 투표·북마크·게시글 기록이 즉시 함께 삭제됩니다.
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            아래 항목은 위 원칙에 따른 세부 내용입니다. 외부 사업자(국외이전) 항목은 데이터를 넘겨
            "판매"하는 것이 아니라, 로그인·저장·호스팅 등 <strong>서비스 운영을 위탁</strong>하는 처리자에 관한 안내입니다.
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
              요청 게시글 내용 (모두 회원 계정에 연결되며 외부에 공개되지 않습니다)
            </li>
            <li>
              <strong className="text-neutral-800">방문 통계(익명)</strong>: 방문자 수 집계를 위해
              브라우저 로컬스토리지에 <strong>임의의 익명 식별자</strong>를 저장합니다. 이름·IP·계정과
              연결되지 않아 개인을 식별할 수 없으며, <strong>개인정보에 해당하지 않습니다.</strong>
            </li>
            <li>
              <strong className="text-neutral-800">광고 쿠키</strong>: 광고 게재 목적으로 Google 등
              광고 제공자가 쿠키를 사용할 수 있습니다(4조 참조).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">3. 위치 정보</h2>
          <p>
            검색 탭 지도 화면에서 <strong>현재 위치</strong> 버튼을 클릭할 때에만 브라우저를 통해
            위치 정보 접근 권한을 요청합니다.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>위치 정보는 지도 중심을 이동하는 데에만 사용되며, 서버로 전송되거나 저장되지 않습니다.</li>
            <li>위치 권한을 허용하지 않으면 해당 기능은 동작하지 않으며, 다른 서비스 이용에는 영향이 없습니다.</li>
            <li>권한은 브라우저 설정에서 언제든지 변경하거나 철회할 수 있습니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">4. 쿠키 및 광고</h2>
          <p>
            이 서비스는 <strong>Google AdSense</strong>를 통해 광고를 제공합니다.
            Google은 광고 게재·맞춤화를 위해 쿠키를 사용하며, 이를 통해 방문 기록이
            익명 통계 형태로 처리될 수 있습니다.
          </p>
          <p>
            <strong>맞춤형(행동기반) 광고 및 동의</strong> — 맞춤형 광고를 위한 쿠키는
            이용자의 동의를 기반으로 사용됩니다. 유럽경제지역(EEA)·영국 등 사전 동의가
            요구되는 지역의 이용자에게는 Google 인증 동의 관리 도구를 통해 광고 쿠키
            동의 여부를 묻는 안내가 표시될 수 있으며, 그 외 지역의 이용자는 아래 방법으로
            언제든지 맞춤형 광고를 거부하거나 쿠키를 차단할 수 있습니다. 동의를 거부해도
            맞춤형이 아닌 일반 광고는 게재될 수 있습니다.
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
              광고 맞춤 설정 해제(동의 철회):{" "}
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
            지도 표시 등 서비스 제공에 필수적인 쿠키는 동의 없이 사용될 수 있으며,
            광고·분석 목적의 쿠키와는 구분됩니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">5. 개인정보 처리위탁 및 국외 이전</h2>
          <p>
            서비스는 운영을 위해 아래 외부 사업자에게 개인정보 처리를 위탁하고 있으며,
            이들 사업자의 서버가 국외에 소재하여 개인정보가 <strong>국외로 이전·보관</strong>될 수 있습니다.
            각 사업자의 개인정보처리방침이 별도로 적용됩니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="py-1.5 pr-3 font-bold">수탁자</th>
                  <th className="py-1.5 pr-3 font-bold">위탁 업무</th>
                  <th className="py-1.5 pr-3 font-bold">이전 항목</th>
                  <th className="py-1.5 font-bold">보관 국가</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600">
                <tr className="border-b border-neutral-100">
                  <td className="py-1.5 pr-3">Supabase Inc.</td>
                  <td className="py-1.5 pr-3">회원 인증·DB 저장·호스팅</td>
                  <td className="py-1.5 pr-3">이메일, 닉네임, 암호화된 비밀번호, 투표·북마크·게시글 기록</td>
                  <td className="py-1.5">미국 등</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-1.5 pr-3">Vercel Inc.</td>
                  <td className="py-1.5 pr-3">웹 호스팅·접속 로그</td>
                  <td className="py-1.5 pr-3">접속 IP·브라우저 정보(서버 로그)</td>
                  <td className="py-1.5">미국 등</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-1.5 pr-3">Google LLC</td>
                  <td className="py-1.5 pr-3">광고 게재(AdSense)·소셜 로그인</td>
                  <td className="py-1.5 pr-3">광고 쿠키 식별자, 소셜 로그인 시 이메일·프로필</td>
                  <td className="py-1.5">미국 등</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3">Kakao Corp.</td>
                  <td className="py-1.5 pr-3">지도 표시(지도 SDK)</td>
                  <td className="py-1.5 pr-3">쿠키(지도 표시 목적)</td>
                  <td className="py-1.5">대한민국</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            이전 시점·방법: 회원가입·서비스 이용 시점에 정보통신망을 통해 암호화하여 전송됩니다.
            이용자는 회원 탈퇴 또는 아래 연락처를 통해 국외 이전을 거부할 수 있으며, 이 경우
            회원 가입이 제한될 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">6. 정보 보유 및 삭제</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li><strong className="text-neutral-800">회원 정보(이메일·닉네임·비밀번호)</strong>: 회원 탈퇴 시까지 보유 → 탈퇴 즉시 파기</li>
            <li><strong className="text-neutral-800">투표·북마크·게시글 기록</strong>: 회원 탈퇴 시 함께 삭제</li>
            <li><strong className="text-neutral-800">방문 카운터(익명 식별자)</strong>: 통계 목적 보관, 개인을 식별하지 않음</li>
            <li><strong className="text-neutral-800">접속 로그</strong>: 호스팅 사업자 정책에 따라 단기 보관 후 자동 삭제</li>
            <li>관계 법령에서 별도 보관을 요구하는 경우 해당 기간 동안 보관 후 파기합니다.</li>
            <li>삭제 요청은 아래 연락처로 이메일을 보내주시면 7일 이내 처리합니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">7. 이용자 권리</h2>
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>개인정보 열람·정정·삭제 요청</li>
            <li>개인정보 처리 정지 요청</li>
            <li>개인정보 국외 이전 거부(회원 탈퇴 또는 연락처 요청)</li>
            <li>광고 쿠키 거부(브라우저 설정 또는 Google 광고 설정)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">8. 개인정보 보호책임자 및 연락처</h2>
          <p>
            서비스는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를
            다음과 같이 지정하고 있습니다. 개인정보 열람·정정·삭제·처리정지 등
            관련 문의는 아래로 연락해 주세요.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>개인정보 보호책임자: 백안맛지도 운영자</li>
            <li>
              연락처:{" "}
              <a href={`mailto:${CONTACT}`} className="text-brand underline-offset-2 hover:underline">
                {CONTACT}
              </a>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">9. 방침 변경</h2>
          <p>
            본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 이 페이지에
            수정일과 함께 공지합니다.
          </p>
        </section>

      </div>
    </div>
  );
}
