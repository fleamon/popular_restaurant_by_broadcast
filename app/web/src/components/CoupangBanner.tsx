"use client";

import { useEffect, useRef } from "react";

const DEFAULT_ID = process.env.NEXT_PUBLIC_COUPANG_WIDGET_ID ?? "";
const DEFAULT_TRACKING = process.env.NEXT_PUBLIC_COUPANG_TRACKING ?? "";

/** 쿠팡 파트너스 다이내믹 배너 위젯.
 *  쿠팡 파트너스 콘솔에서 위젯 생성 시 제공되는 ID/Tracking Code 가 두 가지 필요:
 *    - id            (위젯 id)             → NEXT_PUBLIC_COUPANG_WIDGET_ID
 *    - trackingCode  (AFxxxxxxx 형태 추적 코드) → NEXT_PUBLIC_COUPANG_TRACKING
 *
 *  사용:
 *    <CoupangBanner template="carousel" width="100%" height={140} />
 *
 *  ⚠ 쿠팡 파트너스 약관 — "이 포스팅은 쿠팡 파트너스 활동의 일환으로 이에 따른
 *  일정액의 수수료를 제공받습니다" 같은 명시 문구가 사이트의 노출 가능한 곳에 있어야 함.
 *  현재 about 페이지의 광고 안내 섹션에 명시.
 */
export default function CoupangBanner({
  id,
  trackingCode,
  template = "carousel",
  width = "100%",
  height = 140,
  className,
}: {
  id?: string;
  trackingCode?: string;
  template?: "carousel" | "banner" | "imageAndText";
  width?: string | number;
  height?: number;
  className?: string;
}) {
  const widgetId = id ?? DEFAULT_ID;
  const code = trackingCode ?? DEFAULT_TRACKING;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!widgetId || !code || !ref.current) return;

    // 쿠팡이 제공하는 동적 위젯 스크립트.
    // 콘솔에서 발급된 스니펫의 init 호출을 외부 함수로 노출:
    //   new PartnersCoupang.G({ id, template, trackingCode, width, height });
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://ads-partners.coupang.com/g.js";
    s.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const Init = w?.PartnersCoupang?.G;
      if (typeof Init !== "function" || !ref.current) return;
      // 위젯이 ref 안에 mount 되도록 컨테이너에 임시 id 부여
      const containerId = `coupang-${widgetId}-${Date.now()}`;
      ref.current.id = containerId;
      try {
        new Init({
          id: Number(widgetId),
          template,
          trackingCode: code,
          width,
          height,
          tsource: "",
          containerId,
        });
      } catch { /* 위젯 init 실패 — silent */ }
    };
    ref.current.appendChild(s);
    const node = ref.current;
    return () => { if (node) node.innerHTML = ""; };
  }, [widgetId, code, template, width, height]);

  if (!widgetId || !code) return null;
  return <div ref={ref} className={className} />;
}
