import type { Metadata } from "next";

import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "이용약관 · 백안맛지도",
  description: "백안맛지도 서비스 이용약관",
};

const UPDATED = "2026년 6월 1일";
const CONTACT = "fleabackx@gmail.com";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <PageHeader title="이용약관" subtitle={`최종 수정일: ${UPDATED}`} />

      <div className="space-y-6 text-sm leading-relaxed text-neutral-700">

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제1조 (목적)</h2>
          <p>
            본 약관은 백안맛지도(이하 "서비스")가 제공하는 방송·유튜브 소개 맛집 정보 제공 및
            관련 부가 서비스의 이용조건과 절차, 이용자와 서비스의 권리·의무·책임사항을 규정하는 것을
            목적으로 합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제2조 (약관의 효력 및 변경)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</li>
            <li>서비스는 관계 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 이 페이지에 수정일과 함께 공지합니다.</li>
            <li>이용자가 개정 약관에 동의하지 않는 경우 회원 탈퇴를 통해 이용계약을 해지할 수 있습니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제3조 (서비스의 내용)</h2>
          <p>서비스는 다음 기능을 제공합니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>TV·유튜브·블로그 등에 공개적으로 소개된 음식점 정보의 지도·목록 제공</li>
            <li>맛집·채널·영상에 대한 이용자 좋아요(추천) 및 랭킹</li>
            <li>북마크, 요청 게시판(채널 추가·버그 제보·문의 등) 등 부가 기능</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제4조 (회원가입 및 계정)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>이용자는 이메일 또는 소셜 로그인을 통해 회원가입할 수 있습니다.</li>
            <li>이용자는 본인의 계정 정보를 관리할 책임이 있으며, 제3자에게 양도·대여할 수 없습니다.</li>
            <li>이용자는 언제든지 마이페이지에서 회원 탈퇴를 할 수 있으며, 탈퇴 시 관련 기록은 개인정보처리방침에 따라 처리됩니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제5조 (이용자의 의무 및 금지행위)</h2>
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>타인을 비방·모욕하거나 명예를 훼손하는 행위</li>
            <li>특정 업소·인물에 대한 허위사실 유포 또는 업무를 방해하는 행위</li>
            <li>자동화 수단 등을 이용한 투표 조작·부정 이용 행위</li>
            <li>법령 또는 공서양속에 반하는 내용의 게시물 작성</li>
            <li>서비스의 운영을 방해하거나 타인의 권리를 침해하는 행위</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제6조 (게시물의 관리)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>이용자가 작성한 게시물의 권리와 책임은 작성자 본인에게 있습니다.</li>
            <li>서비스는 게시물이 제5조의 금지행위에 해당하거나 권리 침해 신고가 접수된 경우, 사전 통지 없이 해당 게시물을 삭제하거나 노출을 제한할 수 있습니다.</li>
            <li>이용자는 본인 게시물에 대해 언제든지 수정·삭제를 요청할 수 있습니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제7조 (정보의 출처 및 면책)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>
              서비스가 제공하는 맛집 정보는 TV·유튜브 등 <strong>공개된 콘텐츠</strong>를 기반으로 수집·정리한 것으로,
              실제 영업 여부·주소·메뉴·가격 등의 정확성이나 최신성을 보장하지 않습니다.
            </li>
            <li>
              좋아요(추천) 및 랭킹은 <strong>이용자 개개인의 주관적 선호의 합산</strong>일 뿐,
              특정 업소의 품질·위생·신용에 대한 서비스의 평가나 사실의 적시가 아닙니다.
            </li>
            <li>
              <strong>업소 관계자 요청</strong>: 정보의 정정·삭제가 필요한 업소 관계자는 아래 연락처로 요청해 주시면 확인 후 신속히 조치합니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제8조 (지식재산권)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>유튜브 영상·썸네일·채널명 등은 각 권리자에게 저작권이 있으며, 서비스는 식별·연결 목적의 링크 및 공식 임베드 형태로만 제공합니다.</li>
            <li>서비스의 화면 구성·로고·디자인 등에 대한 권리는 서비스 운영자에게 있습니다.</li>
            <li>권리 침해가 있다고 판단되는 경우 아래 연락처로 알려주시면 신속히 검토·조치합니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제9조 (서비스의 중단 및 변경)</h2>
          <p>
            서비스는 운영상·기술상의 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.
            이 경우 가능한 범위에서 사전에 공지합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제10조 (책임의 제한)</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-600">
            <li>본 서비스는 무료로 제공되며, 서비스 이용 또는 정보의 활용으로 발생한 손해에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
            <li>이용자 간 또는 이용자와 제3자 간에 발생한 분쟁에 대해 서비스는 개입할 의무가 없으며 책임을 지지 않습니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제11조 (준거법 및 관할)</h2>
          <p>
            본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁에 대해서는
            관계 법령이 정한 절차에 따른 법원을 관할 법원으로 합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-neutral-900">제12조 (문의처)</h2>
          <p>
            약관·게시물·정보 정정 등에 관한 문의는 아래로 연락해 주세요.
          </p>
          <p>
            <a href={`mailto:${CONTACT}`} className="text-brand underline-offset-2 hover:underline">
              {CONTACT}
            </a>
          </p>
        </section>

      </div>
    </div>
  );
}
