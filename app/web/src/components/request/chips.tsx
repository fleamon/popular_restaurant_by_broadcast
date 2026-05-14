"use client";

import { NOTICE_STYLE, REQUEST_TYPE_LABEL, type RequestStatus, type RequestType } from "@/lib/api";
import { STATUS_STYLE } from "./constants";

export function TypeChip({ type }: { type: RequestType }) {
  const isNotice = type === "notice";
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={isNotice
        ? { color: NOTICE_STYLE.color, background: "rgb(252 230 170)" }
        : { color: "rgb(75 85 99)", background: "rgb(243 244 246)" }}
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
