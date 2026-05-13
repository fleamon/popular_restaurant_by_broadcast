"use client";

/** 사이트 공용 페이지네이션 — ◀◀ / ◀ / 현재/총 / ▶ / ▶▶.
 *  totalPages 1 이하면 아무것도 렌더 안 함.
 */
export default function Pagination({
  page,
  totalPages,
  onChange,
  totalCount,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  /** 표시 라벨에 "총 N" 같이 합치고 싶을 때만 전달 — 없으면 page/total 만 표시 */
  totalCount?: number;
}) {
  // 1페이지만 있어도 표시 — 통일성. 모든 버튼 자동 disabled 상태로 그려짐.
  const safeTotal = Math.max(1, totalPages);
  const first = () => onChange(1);
  const prev  = () => onChange(Math.max(1, page - 1));
  const next  = () => onChange(Math.min(safeTotal, page + 1));
  const last  = () => onChange(safeTotal);
  const atFirst = page <= 1;
  const atLast = page >= safeTotal;

  return (
    <div className="mt-3 flex items-center justify-center gap-1 text-sm">
      <Btn onClick={first} disabled={atFirst} title="첫 페이지">◀◀</Btn>
      <Btn onClick={prev}  disabled={atFirst} title="이전 페이지">◀</Btn>
      <span className="px-2 font-bold text-neutral-700 tabular-nums">
        {page} / {safeTotal}
        {typeof totalCount === "number" && (
          <span className="ml-2 font-normal text-neutral-400">(총 {totalCount})</span>
        )}
      </span>
      <Btn onClick={next} disabled={atLast} title="다음 페이지">▶</Btn>
      <Btn onClick={last} disabled={atLast} title="마지막 페이지">▶▶</Btn>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="rounded border border-neutral-200 bg-white px-2 py-1 font-bold text-neutral-700 hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
    >
      {children}
    </button>
  );
}
