"use client";

/** 투표 대상 라벨 chip — "식당/채널/영상" 을 색깔 chip 으로 표시.
 *  좋아요/싫어요 버튼 옆에 두어서 어떤 대상에 투표하는 건지 한눈에 구분. */
export type VoteKind = "restaurant" | "channel" | "appearance";

const CONFIG: Record<VoteKind, { text: string; color: string; bg: string }> = {
  restaurant: { text: "식당", color: "rgb(20 100 200)",  bg: "rgb(235 244 255)" },
  channel:    { text: "채널", color: "rgb(140 50 180)",  bg: "rgb(247 238 252)" },
  appearance: { text: "영상", color: "rgb(180 80 30)",   bg: "rgb(255 243 230)" },
};

export default function VoteLabel({ kind, className }: { kind: VoteKind; className?: string }) {
  const c = CONFIG[kind];
  return (
    <span
      className={[
        "shrink-0 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none",
        className ?? "",
      ].join(" ")}
      style={{ color: c.color, background: c.bg }}
    >
      {c.text}
    </span>
  );
}
