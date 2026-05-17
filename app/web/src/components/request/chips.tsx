"use client";

import { NOTICE_STYLE, REQUEST_TYPE_LABEL, type RequestStatus, type RequestType } from "@/lib/api";
import { STATUS_STYLE } from "./constants";

// 타입별 색상 — 수정/삭제 요청은 한눈에 구분되도록 색 분리.
const TYPE_STYLE: Record<RequestType, { color: string; bg: string }> = {
  notice:             { color: NOTICE_STYLE.color, bg: "rgb(252 230 170)" },
  restaurant_edit:    { color: "rgb(43 127 255)",  bg: "rgb(225 238 255)" }, // brand 톤
  restaurant_delete:  { color: "rgb(190 40 40)",   bg: "rgb(255 226 226)" }, // 빨강
  channel_add:        { color: "rgb(75 85 99)",    bg: "rgb(243 244 246)" },
  admin_request:      { color: "rgb(75 85 99)",    bg: "rgb(243 244 246)" },
  bug:                { color: "rgb(75 85 99)",    bg: "rgb(243 244 246)" },
  etc:                { color: "rgb(75 85 99)",    bg: "rgb(243 244 246)" },
};

export function TypeChip({ type }: { type: RequestType }) {
  const s = TYPE_STYLE[type];
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{ color: s.color, background: s.bg }}
    >
      {REQUEST_TYPE_LABEL[type]}
    </span>
  );
}

export function StatusChip({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold leading-none"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  );
}
