"use client";

import { useEffect, useState } from "react";

import { api, type IngestEvent } from "@/lib/api";

/** 화면에 유지할 이벤트 로그 최대 개수 — 그 이상은 오래된 것부터 잘라낸다.
 *  이벤트 수천 개가 누적되면 DOM 노드도 그만큼 늘어 브라우저 탭이 응답 불가 → 흰화면 → 스트림 단절. */
const MAX_LOG_EVENTS = 300;

/** superadmin 전용 — 채널 자동 수집.
 *  - 줄바꿈/쉼표로 다중 핸들 입력 → SSE 진행상황 실시간 수신
 *  - 백엔드: YouTube Data API → OpenAI 추출 → Kakao Local 보강 → DB 저장
 */
export default function ChannelIngest({ onChanged }: { onChanged: () => void }) {
  const [handlesText, setHandlesText] = useState("");
  const [maxVideos, setMaxVideos] = useState(10);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<IngestEvent[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  // 전체 누적 카운터 — events 가 cap 되어도 정확한 합계 유지
  const [stats, setStats] = useState({ saved: 0, skipped: 0, doneChannels: 0 });

  // 줄바꿈/쉼표 구분, 공백 제거, dedupe
  const handles = Array.from(new Set(
    handlesText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
  ));

  // 실행 중 페이지 이탈 방지
  useEffect(() => {
    if (!running) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  function appendEvent(ev: IngestEvent) {
    setEvents((prev) => {
      const next = prev.length >= MAX_LOG_EVENTS ? prev.slice(prev.length - MAX_LOG_EVENTS + 1) : prev;
      return [...next, ev];
    });
  }

  // 최초 마운트 — 기존 채널의 @handle 자동 채움 (한 번만)
  useEffect(() => {
    if (prefilled) return;
    api.listChannels().then((channels) => {
      const list = channels
        .map((c) => {
          const m = (c.wiki_url ?? "").match(/\/@([^/?#\s]+)/);
          return m ? `@${m[1]}` : null;
        })
        .filter((h): h is string => h !== null);
      setHandlesText(list.join("\n"));
      setPrefilled(true);
    }).catch(() => setPrefilled(true));
  }, [prefilled]);

  async function run() {
    if (handles.length === 0 || running) return;
    setRunning(true);
    setEvents([]);
    setStats({ saved: 0, skipped: 0, doneChannels: 0 });
    try {
      for (let i = 0; i < handles.length; i++) {
        const h = handles[i];
        appendEvent({ stage: "batch_start", index: i + 1, total: handles.length, handle: h });
        try {
          for await (const ev of api.ingestChannel(h, maxVideos)) {
            if      (ev.stage === "restaurant_saved")   setStats((s) => ({ ...s, saved: s.saved + 1 }));
            else if (ev.stage === "restaurant_skipped") setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
            else if (ev.stage === "done")               setStats((s) => ({ ...s, doneChannels: s.doneChannels + 1 }));
            appendEvent(ev);
            if (ev.stage === "channel" || ev.stage === "restaurant_saved") onChanged();
          }
        } catch (e) {
          appendEvent({ stage: "error", message: `${h}: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    } finally {
      setRunning(false);
    }
  }

  const { saved: savedCount, skipped: skippedCount, doneChannels } = stats;

  return (
    <section className="space-y-3">
      <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>채널 자동 수집</h2>
      <p className="text-xs font-bold" style={{ color: "rgb(110 120 140)" }}>
        DB 에 등록된 채널의 <code className="font-mono">@handle</code> 이 자동으로 채워집니다. 한 줄에 하나씩 입력하면 순서대로 처리됩니다.
        영상 설명에서 가게를 자동 추출 → 카카오 보강 → 맛집·채널·영상 DB 저장. 영상당 ~5초 소요.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-brand bg-brand-surface p-3">
        <label className="block flex-1 min-w-[280px]">
          <span className="mb-1 block text-xs font-bold text-neutral-700">
            채널 핸들/URL ({handles.length} 개)
          </span>
          <textarea
            value={handlesText}
            onChange={(e) => setHandlesText(e.target.value)}
            placeholder={"@sungsikyung\n@bimirya\n@heebab"}
            disabled={running}
            rows={4}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-mono text-black focus:border-brand focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-neutral-700">채널당 영상 수</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxVideos}
            onChange={(e) => setMaxVideos(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            disabled={running}
            className="w-[110px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={running || handles.length === 0}
          className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {running ? "수집 중…" : `▶ ${handles.length || 0}개 채널 수집 시작`}
        </button>
      </div>

      {(events.length > 0 || running) && (
        <div className="flex flex-wrap gap-3 text-xs font-bold text-neutral-700">
          <span>📺 채널 {doneChannels} / {handles.length || "?"}</span>
          <span>✅ 저장 {savedCount}</span>
          <span>⏭ 스킵 {skippedCount}</span>
          {!running && doneChannels > 0 && (
            <span style={{ color: "rgb(20 130 60)" }}>🏁 전체 완료</span>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-neutral-200 bg-white p-2 text-xs">
          <ul className="space-y-1">
            {[...events].reverse().map((ev, idx) => (
              <li key={events.length - idx} className="font-mono leading-snug">
                {renderEvent(ev)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function renderEvent(ev: IngestEvent): React.ReactNode {
  switch (ev.stage) {
    case "batch_start":
      return (
        <span className="block border-t border-dashed border-brand pt-1 mt-1" style={{ color: "rgb(43 127 255)", fontWeight: 700 }}>
          ━━━ [{ev.index}/{ev.total}] {ev.handle} ━━━
        </span>
      );
    case "channel":
      return <span style={{ color: "rgb(20 30 80)" }}>📺 채널 확인 — {ev.channel.name} (id={ev.channel.id})</span>;
    case "videos_fetched":
      return <span style={{ color: "rgb(80 95 130)" }}>🎬 영상 목록 로드 — {ev.count} 개</span>;
    case "video_start":
      return <span style={{ color: "rgb(80 95 130)" }}>[{ev.i}/{ev.n}] {ev.title.slice(0, 60)}</span>;
    case "video_extracted":
      return <span style={{ color: "rgb(43 127 255)" }}>   ↳ 추출: {ev.found.length === 0 ? "(없음)" : ev.found.join(", ")}</span>;
    case "restaurant_saved":
      return <span style={{ color: "rgb(20 130 60)" }}>   ✅ {ev.restaurant.name} · {ev.restaurant.address}</span>;
    case "restaurant_skipped":
      return <span style={{ color: "rgb(200 100 40)" }}>   ⏭ {ev.name} — {ev.reason}</span>;
    case "video_done":
      return ev.skip
        ? <span style={{ color: "rgb(150 120 60)" }}>   ─ skip: {ev.skip}</span>
        : null;
    case "done":
      return <span style={{ color: "rgb(20 130 60)", fontWeight: 700 }}>🏁 완료 — 영상 {ev.summary.videos}, 저장 {ev.summary.saved}, 스킵 {ev.summary.skipped}</span>;
    case "error":
      return <span style={{ color: "rgb(200 40 40)", fontWeight: 700 }}>❌ {ev.message}</span>;
  }
}
