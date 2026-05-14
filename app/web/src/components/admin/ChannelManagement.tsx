"use client";

import { useEffect, useMemo, useState } from "react";

import Pagination from "@/components/Pagination";
import { api, type Channel, type ChannelUpdateBody } from "@/lib/api";

const PAGE_SIZE = 5;

/** superadmin 전용 — 채널 관리.
 * - 채널 타입 / YouTube URL / 썸네일 URL 직접 편집
 * - 🔄 자동 가져오기 — wiki_url 페이지의 og:image 를 thumbnail_url 로 저장
 */
export default function ChannelManagement({
  onChanged,
  channelsRevision,
}: {
  onChanged: () => void;
  channelsRevision: number;
}) {
  const [rows, setRows] = useState<Channel[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  function reload() {
    api.listChannels().then(setRows).catch(() => setRows([]));
  }

  useEffect(() => { reload(); }, [channelsRevision]);
  useEffect(() => { setPage(1); }, [q]);

  // 채널명 like 필터 (클라이언트 측 — 채널 수가 많지 않은 도메인)
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (r.name ?? "").toLowerCase().includes(needle));
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function save(id: number, body: ChannelUpdateBody) {
    setBusyId(id);
    setMsg(null);
    try {
      await api.updateChannel(id, body);
      setMsg("✅ 저장 완료");
      reload();
      onChanged();
    } catch (e) {
      setMsg("❌ 저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function autoFetch(id: number) {
    setBusyId(id);
    setMsg("og:image 조회 중…");
    try {
      const r = await api.fetchChannelThumbnail(id);
      setMsg(`✅ 자동 가져오기 성공: ${r.thumbnail_url}`);
      reload();
      onChanged();
    } catch (e) {
      setMsg("❌ 자동 가져오기 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  const msgColor = msg?.startsWith("✅") ? "rgb(20 130 60)"
                 : msg?.startsWith("❌") ? "rgb(200 40 40)"
                 : "rgb(80 95 130)";

  return (
    <section className="space-y-3">
      <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>채널 관리</h2>
      <p className="text-xs font-bold" style={{ color: "rgb(110 120 140)" }}>
        YouTube 채널 URL(예: https://www.youtube.com/@sungsikyung) 을 저장한 뒤 <b>🔄 자동 가져오기</b> 를 누르면 채널 아바타가 썸네일에 들어갑니다. 직접 이미지 URL 을 붙여넣어도 됩니다.
      </p>
      <input
        placeholder="채널 이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-sm rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
      />

      <div className="overflow-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead style={{ background: "rgb(245 247 252)" }}>
            <tr>
              {["#", "썸네일", "이름", "타입", "채널 URL (wiki_url)", "썸네일 URL", "actions"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider"
                  style={{ color: "rgb(80 95 130)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visible.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                busy={busyId === c.id}
                onSave={save}
                onFetch={autoFetch}
              />
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "rgb(150 160 180)" }}>결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} totalCount={filtered.length} />

      {msg && <p className="text-xs font-bold" style={{ color: msgColor }}>{msg}</p>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 채널 한 행 — 썸네일 미리보기 + 타입/URL/썸네일URL 편집 + 자동 가져오기
// ─────────────────────────────────────────────────────────────────────
function ChannelRow({
  channel,
  busy,
  onSave,
  onFetch,
}: {
  channel: Channel;
  busy: boolean;
  onSave: (id: number, body: ChannelUpdateBody) => Promise<void>;
  onFetch: (id: number) => Promise<void>;
}) {
  const [type, setType] = useState<Channel["channel_type"]>(channel.channel_type);
  const [wiki, setWiki] = useState(channel.wiki_url ?? "");
  const [thumb, setThumb] = useState(channel.thumbnail_url ?? "");

  // 외부 reload 시 입력란 동기화
  useEffect(() => {
    setType(channel.channel_type);
    setWiki(channel.wiki_url ?? "");
    setThumb(channel.thumbnail_url ?? "");
  }, [channel]);

  const dirty =
    type !== channel.channel_type ||
    (wiki || "") !== (channel.wiki_url ?? "") ||
    (thumb || "") !== (channel.thumbnail_url ?? "");

  return (
    <tr className="hover:bg-brand-surface">
      <td className="px-3 py-2 font-mono text-xs" style={{ color: "rgb(110 120 140)" }}>{channel.id}</td>
      <td className="px-3 py-2">
        {channel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-fg text-base font-bold">
            {channel.name?.trim()?.[0] ?? "·"}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>{channel.name}</td>
      <td className="px-3 py-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Channel["channel_type"])}
          className="rounded border px-2 py-1 text-sm font-bold"
          style={{ color: "rgb(20 30 80)" }}
        >
          <option value="tv">tv</option>
          <option value="youtube">youtube</option>
          <option value="blog">blog</option>
          <option value="other">other</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={wiki}
          onChange={(e) => setWiki(e.target.value)}
          placeholder="https://www.youtube.com/@..."
          className="w-[280px] rounded border px-2 py-1 text-xs font-mono"
          style={{ color: "rgb(20 30 80)" }}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={thumb}
          onChange={(e) => setThumb(e.target.value)}
          placeholder="https://yt3.googleusercontent.com/..."
          className="w-[280px] rounded border px-2 py-1 text-xs font-mono"
          style={{ color: "rgb(20 30 80)" }}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <button
            disabled={busy || !dirty}
            onClick={() => onSave(channel.id, { channel_type: type, wiki_url: wiki || null, thumbnail_url: thumb || null })}
            className="rounded bg-brand px-2 py-1 text-xs font-bold text-brand-fg disabled:opacity-50"
          >
            저장
          </button>
          <button
            disabled={busy || !channel.wiki_url}
            title={!channel.wiki_url ? "먼저 채널 URL 을 저장하세요" : ""}
            onClick={() => onFetch(channel.id)}
            className="rounded border border-brand px-2 py-1 text-xs font-bold text-brand disabled:opacity-50"
          >
            🔄 자동 가져오기
          </button>
        </div>
      </td>
    </tr>
  );
}
