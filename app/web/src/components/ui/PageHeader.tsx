"use client";

/** 각 페이지 상단 H1 — '검색 / 투표 / 요청 게시판 / 소개 / DB 관리' 모두 동일 시각 패턴. */
export default function PageHeader({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm font-bold" style={{ color: "rgb(110 120 140)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot}
    </header>
  );
}
