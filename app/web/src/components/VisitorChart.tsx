"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

type Row = { date: string; count: number };

const W = 600;
const H = 180;
const PAD = { t: 20, r: 16, b: 36, l: 44 };
const CHART_W = W - PAD.l - PAD.r;
const CHART_H = H - PAD.t - PAD.b;

const PERIODS = [
  { label: "7일",  days: 7  },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
];

/** 오늘 날짜를 YYYY-MM-DD 로 (브라우저 로컬 기준) */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VisitorChart() {
  const today = todayStr();

  // 기간 프리셋 (null 이면 커스텀 날짜 범위 사용)
  const [activeDays, setActiveDays] = useState<number | null>(30);
  const [start, setStart] = useState("");
  const [end,   setEnd]   = useState("");
  const [firstDate, setFirstDate] = useState("");

  const [data,    setData]    = useState<Row[]>([]);
  const [referers, setReferers] = useState<{ referer: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // 최초 방문 날짜 로드
  useEffect(() => {
    api.visitFirstDate().then((r) => setFirstDate(r.first_date)).catch(() => {});
  }, []);

  // 데이터 패치 — activeDays 또는 start/end 변경 시
  useEffect(() => {
    setLoading(true);
    const promise =
      activeDays !== null
        ? api.visitDaily(activeDays)
        : start && end
          ? api.visitDaily(undefined, start, end)
          : null;

    if (!promise) { setLoading(false); return; }

    promise
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));

    // 유입 출처 — 같은 기간 기준
    const refPromise =
      activeDays !== null
        ? api.visitReferers(activeDays)
        : start && end
          ? api.visitReferers(undefined, start, end)
          : null;
    if (refPromise) refPromise.then(setReferers).catch(() => setReferers([]));
  }, [activeDays, start, end]);

  // 프리셋 버튼 클릭
  function handlePreset(days: number) {
    setActiveDays(days);
    setStart("");
    setEnd("");
  }

  // 날짜 직접 선택
  function handleStart(v: string) {
    setStart(v);
    setActiveDays(null);
    // end 가 start 보다 앞이면 end 도 같이 당김
    if (end && v > end) setEnd(v);
  }
  function handleEnd(v: string) {
    setEnd(v);
    setActiveDays(null);
  }

  const periodSum = data.reduce((s, d) => s + d.count, 0);
  const todayRow  = data[data.length - 1];

  const max  = Math.max(...data.map((d) => d.count), 1);
  const step = CHART_W / Math.max(data.length - 1, 1);

  const pts = data.map((d, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + CHART_H * (1 - d.count / max),
    date: d.date,
    count: d.count,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    pts.length > 1
      ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + CHART_H).toFixed(1)} L${PAD.l.toFixed(1)},${(PAD.t + CHART_H).toFixed(1)} Z`
      : "";

  const yTicks = [0, 0.5, 1].map((f) => ({
    y: PAD.t + CHART_H * (1 - f),
    label: f === 0 ? "0" : Math.round(max * f).toLocaleString(),
  }));

  const xStep  = Math.max(1, Math.ceil(data.length / 6));
  const xLabels = pts.filter((_, i) => i % xStep === 0 || i === pts.length - 1);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      {/* ── 헤더 ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-soft text-base font-bold" style={{ color: "rgb(20 30 80)" }}>
          일별 방문자
        </h2>

        {/* 프리셋 버튼 */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => handlePreset(p.days)}
              className={[
                "rounded px-2 py-0.5 text-xs font-bold transition-colors",
                activeDays === p.days
                  ? "bg-brand text-white"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 날짜 직접 선택 */}
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="date"
            value={start}
            min={firstDate || undefined}
            max={end || today}
            onChange={(e) => handleStart(e.target.value)}
            className={[
              "rounded border px-1.5 py-0.5 text-xs",
              activeDays === null && start
                ? "border-brand text-brand font-bold"
                : "border-neutral-200 text-neutral-600",
            ].join(" ")}
          />
          <span>~</span>
          <input
            type="date"
            value={end}
            min={start || firstDate || undefined}
            max={today}
            onChange={(e) => handleEnd(e.target.value)}
            className={[
              "rounded border px-1.5 py-0.5 text-xs",
              activeDays === null && end
                ? "border-brand text-brand font-bold"
                : "border-neutral-200 text-neutral-600",
            ].join(" ")}
          />
        </div>

        {/* 오늘 / 기간 합산 */}
        <div className="ml-auto text-right text-xs text-neutral-500">
          오늘{" "}
          <span className="font-bold text-brand">{todayRow?.count.toLocaleString() ?? "—"}</span>
          <span className="mx-1.5 text-neutral-300">·</span>
          기간 합산{" "}
          <span className="font-bold text-brand">{periodSum.toLocaleString()}</span>
          <span className="ml-1 text-neutral-400">(재방문 중복 포함)</span>
        </div>
      </div>

      {/* ── 차트 ── */}
      {loading ? (
        <div className="flex h-[120px] items-center justify-center text-xs text-neutral-400">
          불러오는 중…
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-xs text-neutral-400">
          해당 기간에 방문 데이터가 없습니다.
        </div>
      ) : (
        <LineChart
          pts={pts}
          areaPath={areaPath}
          linePath={linePath}
          yTicks={yTicks}
          xLabels={xLabels}
          step={step}
          max={max}
        />
      )}

      {/* ── 유입 출처 (referer) ── */}
      {!loading && referers.length > 0 && (
        <ReferersBreakdown rows={referers} />
      )}
    </div>
  );
}

// ─── 유입 출처 막대 목록 ───────────────────────────────────────────────────────
function ReferersBreakdown({ rows }: { rows: { referer: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  const top = rows.slice(0, 8);
  return (
    <div className="mt-4 border-t border-neutral-100 pt-3">
      <div className="mb-2 text-xs font-bold text-neutral-500">유입 출처</div>
      <ul className="space-y-1.5">
        {top.map((r) => {
          const pct = Math.round((r.count / total) * 100);
          return (
            <li key={r.referer} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate font-bold text-neutral-700" title={r.referer}>
                {r.referer}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-neutral-500">
                {r.count.toLocaleString()} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── SVG 꺾은선 차트 ──────────────────────────────────────────────────────────

type Pt = { x: number; y: number; date: string; count: number };

function LineChart({
  pts, areaPath, linePath, yTicks, xLabels, step, max,
}: {
  pts: Pt[];
  areaPath: string;
  linePath: string;
  yTicks: { y: number; label: string }[];
  xLabels: Pt[];
  step: number;
  max: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hPt = hovered !== null ? pts[hovered] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: "auto" }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Y축 그리드 */}
      {yTicks.map((t) => (
        <g key={t.y}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#f0f0f0" strokeWidth="1" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#bbb">{t.label}</text>
        </g>
      ))}

      {/* 면적 */}
      {areaPath && <path d={areaPath} fill="#2B7FFF" fillOpacity="0.07" />}

      {/* 꺾은선 */}
      <path d={linePath} fill="none" stroke="#2B7FFF" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

      {/* 점 */}
      {pts.map((p, i) => (
        <circle
          key={i} cx={p.x} cy={p.y}
          r={hovered === i ? 4 : 2.5}
          fill="#2B7FFF" stroke="white" strokeWidth={hovered === i ? 1.5 : 0}
        />
      ))}

      {/* 호버 감지 영역 */}
      {pts.map((p, i) => (
        <rect
          key={i}
          x={p.x - step / 2} y={PAD.t}
          width={step} height={CHART_H}
          fill="transparent"
          onMouseEnter={() => setHovered(i)}
        />
      ))}

      {/* X축 라벨 */}
      {xLabels.map((p) => (
        <text key={p.date} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#bbb">
          {p.date.slice(5)}
        </text>
      ))}

      {/* 툴팁 */}
      {hPt && (() => {
        const TW = 82, TH = 22;
        const rx = Math.min(Math.max(hPt.x - TW / 2, PAD.l), W - PAD.r - TW);
        const ry = hPt.y > PAD.t + CHART_H / 2 ? hPt.y - TH - 6 : hPt.y + 6;
        return (
          <g>
            <line x1={hPt.x} x2={hPt.x} y1={PAD.t} y2={PAD.t + CHART_H}
              stroke="#2B7FFF" strokeWidth="1" strokeDasharray="3,2" />
            <rect x={rx} y={ry} width={TW} height={TH} rx="4" fill="rgb(20 30 80)" />
            <text x={rx + TW / 2} y={ry + TH / 2 + 4} textAnchor="middle" fontSize="10" fill="white">
              {hPt.date.slice(5)} · {hPt.count.toLocaleString()}명
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
