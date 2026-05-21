"use client";

import { useEffect } from "react";

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { adsbygoogle: any[] }
}

/** Google AdSense 광고 슬롯.
 *  사용 — AdSense 콘솔에서 광고 단위 생성 후 발급받은 slot ID 를 prop 으로:
 *
 *    <AdSlot slot="1234567890" />
 *    <AdSlot slot="1234567890" format="rectangle" />
 *
 *  광고 정책상 admin/auth/blocked 같은 기능 페이지에는 두지 말 것.
 */
export default function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  className,
  style,
}: {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical" | "fluid";
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  useEffect(() => {
    if (!AD_CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense loader 가 아직 안 떴거나 광고 차단됨 — silent
    }
  }, [slot]);

  if (!AD_CLIENT) return null;

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`.trim()}
      style={style ?? { display: "block" }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
