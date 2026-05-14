"use client";

/** 폼 하단 제출 라인 — 좌측 메시지(성공/실패), 우측 등록 버튼.
 *  msg 의 prefix(✅/❌) 에 따라 색이 자동 결정. */
export default function SubmitRow({
  busy,
  msg,
  onSubmit,
  label = "요청 등록",
  busyLabel = "등록 중…",
}: {
  busy: boolean;
  msg: string | null;
  onSubmit: () => void;
  label?: string;
  busyLabel?: string;
}) {
  const msgClass = msg?.startsWith("✅") ? "text-emerald-700" : "text-red-600";
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs font-bold ${msg ? msgClass : ""}`}>{msg}</span>
      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}
