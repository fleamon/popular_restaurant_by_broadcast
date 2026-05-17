"use client";

import { useCallback, useEffect, useState } from "react";

import { StatusChip } from "@/components/request/chips";
import { api, type RequestSummary } from "@/lib/api";

/** /admin 의 superadmin 전용 패널 — admin 이 보낸 맛집/영상 수정·삭제 요청을 한 번에 승인/반려.
 *  목록은 status='요청' 인 것만. 적용/반려 후엔 자동으로 목록에서 빠짐(상태 전이).
 */
export default function RestaurantRequestApproval({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<RequestSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    Promise.all([
      api.listRequests({ type: "restaurant_edit",   status: "요청" }),
      api.listRequests({ type: "restaurant_delete", status: "요청" }),
    ])
      .then(([a, b]) => setRows([...a, ...b].sort((x, y) => y.id - x.id)))
      .catch(() => setRows([]));
  }, [reloadKey]);

  async function approve(r: RequestSummary) {
    const kind = r.type === "restaurant_edit" ? "수정" : "삭제";
    if (!window.confirm(`이 ${kind} 요청을 적용합니다. 계속할까요?`)) return;
    setBusyId(r.id);
    try {
      if (r.type === "restaurant_edit")   await api.applyRestaurantEdit(r.id);
      if (r.type === "restaurant_delete") await api.applyRestaurantDelete(r.id);
      bumpReload();
      onChanged?.();
    } catch (e) {
      alert(`적용 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r: RequestSummary) {
    if (!window.confirm("이 요청을 반려합니다. 상태가 '반려' 로 바뀝니다. 계속할까요?")) return;
    setBusyId(r.id);
    try {
      await api.updateRequestStatus(r.id, "반려");
      bumpReload();
      onChanged?.();
    } catch (e) {
      alert(`반려 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>
          맛집/영상 수정·삭제 요청 ({rows.length})
        </h2>
        <p className="text-xs font-bold" style={{ color: "rgb(110 120 140)" }}>
          admin 이 보낸 요청을 변경 사항 확인 후 [✅ 승인] 또는 [🚫 반려].
        </p>
      </header>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-sm font-bold text-neutral-400">대기 중 요청 없음</li>
        )}
        {rows.map((r) => {
          const isDelete = r.type === "restaurant_delete";
          // type 별 좌측 컬러 바 — 수정(brand) vs 삭제(빨강) 즉시 구분
          const accent = isDelete ? "rgb(190 40 40)" : "rgb(43 127 255)";
          const sectionLabel = isDelete ? "🗑 삭제 요청" : "✏ 수정 요청";
          return (
            <li
              key={r.id}
              className="relative space-y-3 px-4 py-4 pl-5"
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold leading-none"
                      style={{ color: accent, background: isDelete ? "rgb(255 226 226)" : "rgb(225 238 255)" }}
                    >
                      {sectionLabel}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                    {r.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-neutral-500">
                    <span>요청자: {r.author_nickname ?? "—"}</span>
                    <span aria-hidden>·</span>
                    <span>{new Date(r.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void approve(r)}
                    disabled={busyId === r.id}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-40"
                  >
                    ✅ 승인
                  </button>
                  <button
                    type="button"
                    onClick={() => void reject(r)}
                    disabled={busyId === r.id}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    🚫 반려
                  </button>
                </div>
              </div>

              <PayloadPreview row={r} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 필드 키 → 한국어 라벨 — 가독성 향상
const FIELD_LABEL: Record<string, string> = {
  current_name:    "가게 이름",
  current_address: "주소",
  cuisine:         "카테고리",
  sido:            "시/도",
  sigungu:         "시/군/구",
  dong:            "동/읍/면",
  lat:             "위도",
  lng:             "경도",
  naver_map_url:   "네이버 지도 URL",
  kakao_map_url:   "카카오 지도 URL",
  naver_place_id:  "네이버 place id",
  kakao_place_id:  "카카오 place id",
  phone:           "전화",
  notes:           "메모",
  episode_title:   "영상 제목",
  source_url:      "영상 URL",
  youtube_video_id: "YouTube ID",
  thumbnail_url:   "썸네일 URL",
  summary:         "요약",
  aired_at:        "방영일",
  channel_id:      "채널",
};
const fieldLabel = (k: string) => FIELD_LABEL[k] ?? k;
const fmtValue = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : typeof v === "string" ? v : JSON.stringify(v);

/** payload 인라인 미리보기 — restaurant_edit 은 before/after 표, restaurant_delete 는 사유 강조. */
function PayloadPreview({ row }: { row: RequestSummary }) {
  const p = row.payload;

  if (row.type === "restaurant_delete") {
    const reason = p?.reason?.trim();
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">삭제 사유</div>
        <div className="mt-1 whitespace-pre-line text-sm font-bold text-neutral-900">
          {reason || <span className="text-neutral-400">(사유 없음)</span>}
        </div>
      </div>
    );
  }

  // restaurant_edit — before/after 페어를 같은 키 기준으로 표 형태로 나열
  const rb = (p?.restaurant_before ?? {}) as Record<string, unknown>;
  const ra = (p?.restaurant_after  ?? {}) as Record<string, unknown>;
  const ab = (p?.appearance_before ?? {}) as Record<string, unknown>;
  const aa = (p?.appearance_after  ?? {}) as Record<string, unknown>;

  const rows: { group: string; key: string; before: unknown; after: unknown }[] = [
    ...Object.keys(ra).map((k) => ({ group: "맛집", key: k, before: rb[k], after: ra[k] })),
    ...Object.keys(aa).map((k) => ({ group: "영상", key: k, before: ab[k], after: aa[k] })),
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-400">
        변경 내용 없음
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="grid grid-cols-[5rem_8rem_1fr_1.5rem_1fr] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
        <span>구분</span>
        <span>필드</span>
        <span>변경 전</span>
        <span aria-hidden />
        <span>변경 후</span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[5rem_8rem_1fr_1.5rem_1fr] items-center gap-2 px-3 py-2 text-xs">
            <span className="shrink-0 rounded bg-brand-surface px-1.5 py-0.5 text-center font-bold leading-none text-brand">
              {r.group}
            </span>
            <span className="font-bold text-neutral-700">{fieldLabel(r.key)}</span>
            <span className="min-w-0 break-words font-mono text-neutral-500 line-through decoration-neutral-300">
              {fmtValue(r.before)}
            </span>
            <span aria-hidden className="text-center font-bold text-neutral-400">→</span>
            <span className="min-w-0 break-words font-mono font-bold" style={{ color: "rgb(20 130 60)" }}>
              {fmtValue(r.after)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
