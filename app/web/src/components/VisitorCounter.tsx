"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { getOrCreateVisitorId } from "@/lib/visitor";

/** 모든 페이지 좌측 하단 fixed 위젯 — 오늘 / 총 unique 방문자.
 *  마운트 시:
 *    1) 익명 visitor_id 확보 (localStorage)
 *    2) /visits/track POST — 오늘 1회만 카운트 (백엔드 unique 인덱스)
 *    3) /visits/stats GET — 표시할 숫자 fetch
 *  실패해도 silent — 위젯이 단순히 안 보이거나 0 으로 표시되고 사이트 본 기능엔 영향 없음.
 */
export default function VisitorCounter() {
  const [stats, setStats] = useState<{ today: number; total: number } | null>(null);

  useEffect(() => {
    const vid = getOrCreateVisitorId();
    if (!vid) return;

    // 같은 세션에서 페이지 이동마다 fetch 가 매번 일어나지 않도록 sessionStorage 마커.
    // 카운트는 백엔드가 unique 인덱스로 중복 제거하지만, 트래픽 절감.
    const TRACK_MARK = "visit_tracked_today";
    let tracked = false;
    try { tracked = window.sessionStorage.getItem(TRACK_MARK) === "1"; } catch { /* ignore */ }

    async function go() {
      try {
        if (!tracked) {
          await api.trackVisit(vid);
          try { window.sessionStorage.setItem(TRACK_MARK, "1"); } catch { /* ignore */ }
        }
        const s = await api.visitStats();
        setStats(s);
      } catch {
        // 백엔드 다운/네트워크 오류 시 위젯 그냥 숨김
      }
    }
    void go();
  }, []);

  if (!stats) return null;

  return (
    <div
      aria-label="방문자 통계"
      className="fixed bottom-3 left-3 z-40 select-none rounded-lg border border-neutral-200 bg-white/90 px-3 py-2 text-[11px] font-bold backdrop-blur shadow-sm"
      style={{ color: "rgb(20 30 80)" }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden>👀</span>
        <span>방문자수<span className="tabular-nums text-brand"></span></span>
        <span className="text-neutral-300">·</span>
        <span>오늘 <span className="tabular-nums text-brand">{stats.today.toLocaleString()}</span></span>
        <span className="text-neutral-300">·</span>
        <span>총 <span className="tabular-nums text-brand">{stats.total.toLocaleString()}</span></span>
      </div>
    </div>
  );
}
