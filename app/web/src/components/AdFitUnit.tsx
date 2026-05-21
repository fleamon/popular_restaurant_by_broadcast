"use client";

import { useEffect, useRef } from "react";

const DEFAULT_UNIT = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT ?? "";

/** 카카오 애드핏 광고 단위.
 *  사용 — 카카오 애드핏 콘솔에서 인벤토리 등록 후 발급받은 unit-id (예: "DAN-xxxxx") 를 prop 으로:
 *
 *    <AdFitUnit width={320} height={100} />          // 기본 unit-id = env
 *    <AdFitUnit unit="DAN-xxxxx" width={728} height={90} />
 *
 *  env 또는 prop 둘 다 없으면 자동 숨김 (가입 전 상태).
 */
export default function AdFitUnit({
  unit,
  width = 320,
  height = 100,
  className,
}: {
  unit?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const adUnit = unit ?? DEFAULT_UNIT;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adUnit || !wrapRef.current) return;
    // 카카오 애드핏 SDK 는 매 mount 마다 ins 요소를 새로 만들어 push 해야 동작.
    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", adUnit);
    ins.setAttribute("data-ad-width", String(width));
    ins.setAttribute("data-ad-height", String(height));
    wrapRef.current.appendChild(ins);

    const s = document.createElement("script");
    s.async = true;
    s.src = "//t1.daumcdn.net/kas/static/ba.min.js";
    wrapRef.current.appendChild(s);

    const node = wrapRef.current;
    return () => { if (node) node.innerHTML = ""; };
  }, [adUnit, width, height]);

  if (!adUnit) return null;
  return <div ref={wrapRef} className={className} />;
}
