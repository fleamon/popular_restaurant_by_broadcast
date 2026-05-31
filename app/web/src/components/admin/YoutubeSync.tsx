"use client";

import { useState } from "react";

import { api, type YoutubeSyncEvent } from "@/lib/api";

type Summary = Extract<YoutubeSyncEvent, { stage: "done" }>["summary"];

/** superadmin 전용 — YouTube 저장 데이터 동기화.
 *  저장된 영상 제목/썸네일을 공식 API 로 갱신하고, 삭제·비공개된 영상의 appearance
 *  (및 고아 식당)를 정리한다. YouTube API 약관(주기적 갱신·동기 삭제) 준수.
 *  자동: 25일 주기 GitHub Actions(youtube-sync.yml). 여기서는 수동 실행.
 */
export default function YoutubeSync({ onChanged }: { onChanged?: () => void }) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [progress, setProgress] = useState({ updated: 0, removed: 0, removedRest: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (running) return;
    if (!confirm("저장된 YouTube 영상을 공식 API 로 재조회합니다.\n삭제·비공개된 영상과 그로 인해 영상이 0개가 된 식당은 DB 에서 삭제됩니다. 진행할까요?")) {
      return;
    }
    setRunning(true);
    setError(null);
    setSummary(null);
    setTotal(null);
    setProgress({ updated: 0, removed: 0, removedRest: 0 });
    let changed = false;
    try {
      for await (const ev of api.syncYoutube()) {
        switch (ev.stage) {
          case "start":
            setTotal(ev.total);
            break;
          case "updated":
            setProgress((p) => ({ ...p, updated: p.updated + 1 }));
            changed = true;
            break;
          case "removed":
            setProgress((p) => ({ ...p, removed: p.removed + 1 }));
            changed = true;
            break;
          case "removed_restaurant":
            setProgress((p) => ({ ...p, removedRest: p.removedRest + 1 }));
            changed = true;
            break;
          case "done":
            setSummary(ev.summary);
            break;
          case "error":
            setError(ev.message);
            break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      if (changed) onChanged?.();
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">YouTube 동기화</h2>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {running ? "동기화 중…" : "지금 동기화"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-neutral-500">
        저장된 영상의 제목·썸네일을 최신화하고, 삭제·비공개된 영상과 고아 식당을 정리합니다.
        (자동: 약 25일마다 실행 — YouTube API 약관 준수)
      </p>

      {running && total !== null && (
        <p className="mt-3 text-sm font-bold text-neutral-600">
          {total}건 검사 중… 갱신 {progress.updated} · 삭제 {progress.removed} · 식당정리 {progress.removedRest}
        </p>
      )}

      {summary && (
        <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm font-bold text-brand">
          ✅ 완료 — 검사 {summary.checked} · 갱신 {summary.updated} · 삭제된 영상 {summary.dead_videos}
          (appearance {summary.removed_appearances}, 식당 {summary.removed_restaurants})
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">❌ {error}</div>
      )}
    </section>
  );
}
