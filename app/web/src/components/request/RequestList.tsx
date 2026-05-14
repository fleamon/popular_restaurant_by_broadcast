"use client";

import { useEffect, useState } from "react";

import Pagination from "@/components/Pagination";
import { api, NOTICE_STYLE, type RequestStatus, type RequestSummary, type RequestType } from "@/lib/api";

import { TypeChip, StatusChip } from "./chips";
import { REQUESTS_PAGE_SIZE, STATUSES } from "./constants";
import RequestDetailPanel from "./RequestDetailPanel";
import { formatDate } from "./utils";

/** 요청 목록 + 페이지네이션 + (superadmin) 다중삭제 + 필터.
 *  공지사항은 항상 최상단 (백엔드에서 이미 정렬되어 옴).
 */
export default function RequestList({
  rows, loggedIn, superadmin, expandedId, onToggle, onChanged,
  typeFilter, statusFilter, onChangeTypeFilter, onChangeStatusFilter,
}: {
  rows: RequestSummary[];
  loggedIn: boolean;
  superadmin: boolean;
  expandedId: number | null;
  onToggle: (id: number) => void;
  onChanged: () => void;
  typeFilter: RequestType | "";
  statusFilter: RequestStatus | "";
  onChangeTypeFilter: (v: RequestType | "") => void;
  onChangeStatusFilter: (v: RequestStatus | "") => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows.length]);
  const totalPages = Math.max(1, Math.ceil(rows.length / REQUESTS_PAGE_SIZE));
  const visible = rows.slice((page - 1) * REQUESTS_PAGE_SIZE, page * REQUESTS_PAGE_SIZE);

  // 다중 선택 (superadmin) — 페이지 이동해도 유지
  const [selected, setSelected] = useState<Set<number>>(new Set());
  function toggleSel(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  const visibleIds = visible.map((r) => r.id);
  const allOnPageChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  function toggleAllOnPage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageChecked) visibleIds.forEach((id) => n.delete(id));
      else                  visibleIds.forEach((id) => n.add(id));
      return n;
    });
  }
  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`선택한 ${selected.size}건을 삭제할까요? 댓글도 함께 삭제됩니다.`)) return;
    try {
      await api.bulkDeleteRequests(Array.from(selected));
      setSelected(new Set());
      onChanged();
    } catch (e) {
      alert("다중 삭제 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-soft text-xl font-bold text-brand">요청 목록</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          {/* superadmin 전용 — 유형/상태 필터 selectbox */}
          {superadmin && (
            <>
              <select
                value={typeFilter}
                onChange={(e) => onChangeTypeFilter(e.target.value as RequestType | "")}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700"
              >
                <option value="">유형 — 전체</option>
                <option value="channel_add">채널 추가요청</option>
                <option value="admin_request">관리자 요청</option>
                <option value="bug">버그 제보</option>
                <option value="etc">기타 요청</option>
                <option value="notice">공지사항</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => onChangeStatusFilter(e.target.value as RequestStatus | "")}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700"
              >
                <option value="">상태 — 전체</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}
          {superadmin && selected.size > 0 && (
            <button
              type="button"
              onClick={() => void bulkDelete()}
              className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
            >
              🗑 선택 {selected.size}건 삭제
            </button>
          )}
          {superadmin && (
            <label className="flex cursor-pointer items-center gap-1.5 text-neutral-600">
              <input
                type="checkbox"
                checked={allOnPageChecked}
                onChange={toggleAllOnPage}
                className="accent-brand"
              />
              <span>현재 페이지 전체 선택</span>
            </label>
          )}
          <span className="text-neutral-400">총 {rows.length}</span>
        </div>
      </div>

      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {visible.map((r) => (
          <RequestRow
            key={r.id}
            row={r}
            expanded={expandedId === r.id}
            loggedIn={loggedIn}
            superadmin={superadmin}
            selected={selected.has(r.id)}
            onToggleSelect={toggleSel}
            onToggleExpand={onToggle}
            onChanged={onChanged}
          />
        ))}
        {visible.length === 0 && (
          <li className="py-8 text-center text-sm font-bold text-neutral-400">아직 요청이 없습니다.</li>
        )}
      </ul>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} totalCount={rows.length} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 한 행 — chip + 제목 + 상태 + 날짜 + (펼친 경우) 상세 패널
// ─────────────────────────────────────────────────────────────────────
function RequestRow({
  row,
  expanded,
  loggedIn,
  superadmin,
  selected,
  onToggleSelect,
  onToggleExpand,
  onChanged,
}: {
  row: RequestSummary;
  expanded: boolean;
  loggedIn: boolean;
  superadmin: boolean;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onChanged: () => void;
}) {
  // 공지사항은 비로그인 포함 누구나 본문 열람. 그 외 타입은 로그인+작성자/superadmin 만.
  const isNotice = row.type === "notice";
  const canOpen = isNotice || (loggedIn && (row.is_mine || superadmin));

  return (
    <li style={isNotice ? { background: NOTICE_STYLE.bg } : undefined}>
      <div className="flex items-stretch">
        {/* 다중 선택 checkbox — superadmin 만 노출 */}
        {superadmin && (
          <label className="flex shrink-0 cursor-pointer items-center pl-3 pr-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(row.id)}
              className="accent-brand"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => { if (canOpen) onToggleExpand(row.id); }}
          disabled={!canOpen}
          className={[
            "flex flex-1 items-center gap-3 px-4 py-3 text-left",
            canOpen ? "cursor-pointer hover:bg-brand-surface" : "cursor-not-allowed",
          ].join(" ")}
          title={canOpen ? "" : "작성자 또는 superadmin 만 내용을 볼 수 있습니다"}
        >
          <TypeChip type={row.type} />
          <span
            className="font-soft flex-1 truncate text-sm font-bold"
            style={{ color: isNotice ? NOTICE_STYLE.color : "rgb(20 30 80)" }}
          >
            {row.title}
          </span>
          {row.is_mine && (
            <span className="shrink-0 rounded bg-brand-surface px-1.5 py-0.5 text-[10px] font-bold text-brand">내 글</span>
          )}
          {!isNotice && <StatusChip status={row.status} />}
          <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">
            {formatDate(row.created_at)}
          </span>
        </button>
      </div>
      {expanded && canOpen && <RequestDetailPanel rid={row.id} onChanged={onChanged} />}
    </li>
  );
}
