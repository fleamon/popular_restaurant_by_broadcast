"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// 후원 — 환경변수에서 직접 읽기 (Next.js 가 NEXT_PUBLIC_* 를 클라이언트 번들에 inline).
// 값이 비어있으면 해당 항목은 자동 숨김. 둘 다 비어있으면 섹션 전체가 렌더되지 않음.
const TOSS_QR      = process.env.NEXT_PUBLIC_TOSS_QR      ?? "";
const KAKAOPAY_URL = process.env.NEXT_PUBLIC_KAKAOPAY_URL ?? "";

/** /about 의 개발자 후원 섹션 — 버튼 클릭 시 QR 모달.
 *  - 토스 QR(이미지) 은 모달로 표시 → 모바일은 카메라/토스앱으로 스캔, 데스크탑은 카톡으로 QR 사진 공유
 *  - 카카오페이는 기존대로 외부 URL 로 이동
 */
export default function DonationSection() {
  const [tossOpen, setTossOpen] = useState(false);
  const hasDonation = !!(TOSS_QR || KAKAOPAY_URL);
  if (!hasDonation) return null;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-brand-surface p-5">
      <header>
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">개발자 후원</h2>
        <p className="text-sm text-neutral-600">서버·도메인·API 호출 비용에 큰 힘이 됩니다 🙇‍♀️</p>
      </header>
      <div className="flex flex-wrap gap-2 text-sm">
        {TOSS_QR && (
          <button
            type="button"
            onClick={() => setTossOpen(true)}
            className="rounded-md border border-brand px-3 py-2 font-bold text-brand hover:bg-white"
          >
            💙 토스로 후원
          </button>
        )}
        {KAKAOPAY_URL && (
          <a
            href={KAKAOPAY_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-brand px-3 py-2 font-bold text-brand hover:bg-white"
          >
            🟡 카카오페이 QR
          </a>
        )}
      </div>

      {tossOpen && TOSS_QR && (
        <QrModal
          src={TOSS_QR}
          alt="토스 송금 QR"
          title="💙 토스 송금 QR"
          caption="토스 앱에서 QR 을 스캔해 송금해 주세요. 응원해 주셔서 감사합니다 🙇‍♀️"
          onClose={() => setTossOpen(false)}
        />
      )}
    </section>
  );
}

function QrModal({
  src, alt, title, caption, onClose,
}: {
  src: string;
  alt: string;
  title: string;
  caption: string;
  onClose: () => void;
}) {
  // ESC 키로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // 모달 열리는 동안 body 스크롤 잠금 — 모바일 UX
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-2 top-2 rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
        >
          ✕
        </button>
        <h3 className="mb-3 font-soft text-lg font-bold tracking-tight text-brand">{title}</h3>
        <div className="flex justify-center">
          <Image
            src={src}
            alt={alt}
            width={320}
            height={320}
            className="rounded-md border border-neutral-200 bg-white"
            unoptimized
          />
        </div>
        <p className="mt-3 text-xs font-bold text-neutral-600">{caption}</p>
      </div>
    </div>
  );
}
