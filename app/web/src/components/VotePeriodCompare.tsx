"use client";

import { useEffect, useMemo, useState } from "react";

import {
  api,
  type AppearanceScore,
  type Channel,
  type Restaurant,
  type VoteBody,
} from "@/lib/api";

type TargetType = VoteBody["target_type"];

const TYPE_LABEL: Record<TargetType, string> = {
  restaurant: "맛집",
  channel:    "채널",
  appearance: "영상",
};

type Option = { id: number; label: string };

type Row = {
  key: string;
  target_type: TargetType;
  target_id: number;
  target_name: string;
  from: string;
  to: string;
  likes: number;
  dislikes: number;
  net_score: number;
};

function todayKstISO(): string {
  // 클라이언트 시계가 KST 가 아닐 수 있으므로 UTC +9h offset 으로 안전하게 구성
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** /vote 탭 — 특정 기간 [from, to] (KST 날짜) 동안 대상이 받은 좋아요/싫어요 조회.
 *  여러 항목을 추가해 한 표에서 비교.
 */
export default function VotePeriodCompare() {
  const [type, setType] = useState<TargetType>("restaurant");
  const [name, setName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(todayKstISO());

  // 타입별 옵션 데이터 — 마운트 후 type 바뀔 때만 fetch
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [appearances, setAppearances] = useState<AppearanceScore[]>([]);

  useEffect(() => {
    if (type === "restaurant" && restaurants.length === 0) {
      api.topRestaurants().then(setRestaurants).catch(() => setRestaurants([]));
    } else if (type === "channel" && channels.length === 0) {
      api.listChannels().then(setChannels).catch(() => setChannels([]));
    } else if (type === "appearance" && appearances.length === 0) {
      api.appearanceRanking().then(setAppearances).catch(() => setAppearances([]));
    }
    setName("");
  }, [type, restaurants.length, channels.length, appearances.length]);

  const options = useMemo<Option[]>(() => {
    if (type === "restaurant") return restaurants.map((r) => ({ id: r.id, label: r.current_name }));
    if (type === "channel")    return channels.map((c) => ({ id: c.id, label: c.name }));
    return appearances.map((a) => ({ id: a.appearance_id, label: a.episode_title ?? `영상 ${a.appearance_id}` }));
  }, [type, restaurants, channels, appearances]);

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function addRow() {
    setMsg(null);
    if (!fromDate || !toDate) { setMsg("❌ 기간을 모두 지정하세요."); return; }
    const match = options.find((o) => o.label === name);
    if (!match) { setMsg("❌ 자동완성에서 정확한 대상을 선택하세요."); return; }
    setBusy(true);
    try {
      const r = await api.voteScore(type, match.id, fromDate, toDate);
      setRows((prev) => [
        ...prev,
        {
          key: `${type}-${match.id}-${fromDate}-${toDate}-${Date.now()}`,
          target_type: type, target_id: match.id, target_name: match.label,
          from: fromDate, to: toDate, ...r,
        },
      ]);
      setName("");
    } catch (e) {
      setMsg(`❌ 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      <header>
        <h2 className="font-soft text-xl font-bold tracking-tight text-brand">기간별 투표 조회</h2>
        <p className="text-xs font-bold text-neutral-500">
          대상(맛집·채널·영상) 과 기간(KST 자정 기준 inclusive) 을 지정해 그 사이에 받은
          좋아요/싫어요 합계를 조회합니다. 여러 항목을 추가해 한 표에서 비교할 수 있습니다.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-[7rem_1fr_8rem_8rem_5rem]">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TargetType)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
        >
          {(Object.entries(TYPE_LABEL) as [TargetType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          list="dl-vote-target"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${TYPE_LABEL[type]} 이름 (자동완성)`}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
        />
        <datalist id="dl-vote-target">
          {options.map((o) => <option key={o.id} value={o.label} />)}
        </datalist>

        <input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
        />
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void addRow()}
          disabled={busy}
          className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-40"
        >
          + 조회
        </button>
      </div>

      {msg && <p className="text-xs font-bold text-red-600">{msg}</p>}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-1.5 text-left">구분</th>
                <th className="px-2 py-1.5 text-left">대상</th>
                <th className="px-2 py-1.5 text-left">기간</th>
                <th className="px-2 py-1.5 text-right">좋아요</th>
                <th className="px-2 py-1.5 text-right">싫어요</th>
                <th className="px-2 py-1.5 text-right">순점수</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-2 py-2">
                    <span className="rounded bg-brand-surface px-1.5 py-0.5 text-[11px] font-bold leading-none text-brand">
                      {TYPE_LABEL[r.target_type]}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-bold text-neutral-900">{r.target_name}</td>
                  <td className="px-2 py-2 font-mono text-neutral-500">{r.from} ~ {r.to}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums" style={{ color: "rgb(20 130 60)" }}>{r.likes}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums text-neutral-700">{r.dislikes}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums" style={{ color: "rgb(20 30 80)" }}>{r.net_score}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label="제거"
                      title="제거"
                      className="text-neutral-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-center text-xs font-bold text-neutral-400">
          위에서 대상·기간을 지정하고 [+ 조회] 를 누르면 결과가 누적됩니다.
        </p>
      )}
    </section>
  );
}
