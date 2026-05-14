"use client";

import { useEffect, useState } from "react";

import Field from "@/components/ui/Field";
import { Input, INPUT_CLASS, SELECT_CLASS, TEXTAREA_CLASS, Textarea } from "@/components/ui/inputs";
import { api, type Channel, type RequestType } from "@/lib/api";

import { BASE_TYPE_OPTIONS, NOTICE_OPTION } from "./constants";
import SubmitRow from "./SubmitRow";

/** 요청 작성 폼 — 라디오로 4(또는 5)개 타입 선택 후 자식 폼 분기.
 *  superadmin 만 '공지사항' 라디오가 노출됨. */
export default function RequestForm({
  superadmin,
  onCreated,
}: {
  superadmin: boolean;
  onCreated: () => void;
}) {
  const [type, setType] = useState<RequestType>("channel_add");
  const options = superadmin ? [...BASE_TYPE_OPTIONS, NOTICE_OPTION] : BASE_TYPE_OPTIONS;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-soft text-xl font-bold text-brand">요청 작성</h2>

      <div className="flex flex-wrap gap-3 text-sm">
        {options.map((t) => (
          <label key={t.value} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="request-type"
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="accent-brand"
            />
            <span className={type === t.value ? "font-bold text-brand" : "font-bold text-neutral-600"}>
              {t.label}
            </span>
          </label>
        ))}
      </div>

      {type === "channel_add"   && <ChannelAddForm   onCreated={onCreated} />}
      {type === "admin_request" && <AdminRequestForm onCreated={onCreated} />}
      {type === "bug"           && <SimpleForm type="bug" onCreated={onCreated} />}
      {type === "etc"           && <SimpleForm type="etc" onCreated={onCreated} />}
      {type === "notice"        && <NoticeForm     onCreated={onCreated} />}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 채널 추가요청 — 채널 타입 + 제목(기본값 있음) + URL
// ─────────────────────────────────────────────────────────────────────
function ChannelAddForm({ onCreated }: { onCreated: () => void }) {
  const [channelType, setChannelType] = useState<"tv" | "youtube" | "blog" | "other">("youtube");
  const [title, setTitle] = useState("채널 추가 요청 드립니다.");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !url.trim()) { setMsg("❌ 모든 필드는 필수입니다."); return; }
    setBusy(true); setMsg(null);
    try {
      await api.createRequest({ type: "channel_add", title: title.trim(), channel_type: channelType, channel_url: url.trim() });
      setMsg("✅ 요청이 등록되었습니다.");
      setUrl(""); setTitle("채널 추가 요청 드립니다.");
      onCreated();
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Field label="채널 타입" required>
        <select value={channelType} onChange={(e) => setChannelType(e.target.value as never)} className={SELECT_CLASS}>
          <option value="tv">TV</option>
          <option value="youtube">YouTube</option>
          <option value="blog">Blog</option>
          <option value="other">기타</option>
        </select>
      </Field>
      <Field label="제목" required hint={`${title.length}/100`}>
        <Input value={title} onChange={(v) => setTitle(v.slice(0, 100))} className={INPUT_CLASS} />
      </Field>
      <Field label="채널 URL" required hint={`${url.length}/200`}>
        <Input value={url} onChange={(v) => setUrl(v.slice(0, 200))} placeholder="https://www.youtube.com/@..." />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 관리자 요청 — 제목 + 채널 + 내용
// ─────────────────────────────────────────────────────────────────────
function AdminRequestForm({ onCreated }: { onCreated: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<number | "">("");
  const [title, setTitle] = useState("채널 관리자 요청 드립니다.");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  async function submit() {
    if (!title.trim() || !content.trim() || channelId === "") {
      setMsg("❌ 모든 필드는 필수입니다."); return;
    }
    setBusy(true); setMsg(null);
    try {
      await api.createRequest({ type: "admin_request", title: title.trim(), content: content.trim(), channel_id: channelId });
      setMsg("✅ 요청이 등록되었습니다.");
      setContent(""); setTitle("채널 관리자 요청 드립니다.");
      onCreated();
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Field label="제목" required hint={`${title.length}/100`}>
        <Input value={title} onChange={(v) => setTitle(v.slice(0, 100))} />
      </Field>
      <Field label="관리요청 채널" required>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value === "" ? "" : Number(e.target.value))}
          className={SELECT_CLASS}
        >
          <option value="">— 선택 —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="내용" required hint={`${content.length}/200`}>
        <Textarea value={content} onChange={(v) => setContent(v.slice(0, 200))} rows={4} />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 버그/기타 요청 — 제목 + 내용만
// ─────────────────────────────────────────────────────────────────────
function SimpleForm({ type, onCreated }: { type: "bug" | "etc"; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !content.trim()) { setMsg("❌ 제목과 내용은 필수입니다."); return; }
    setBusy(true); setMsg(null);
    try {
      await api.createRequest({ type, title: title.trim(), content: content.trim() });
      setMsg("✅ 요청이 등록되었습니다.");
      setTitle(""); setContent("");
      onCreated();
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Field label="제목" required hint={`${title.length}/100`}>
        <Input value={title} onChange={(v) => setTitle(v.slice(0, 100))} />
      </Field>
      <Field label="내용" required hint={`${content.length}/200`}>
        <Textarea value={content} onChange={(v) => setContent(v.slice(0, 200))} rows={4} />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 공지사항 — 길이 제한 없음, superadmin 전용
// ─────────────────────────────────────────────────────────────────────
function NoticeForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("[공지] ");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !content.trim()) { setMsg("❌ 제목과 내용은 필수입니다."); return; }
    setBusy(true); setMsg(null);
    try {
      await api.createRequest({ type: "notice", title: title.trim(), content: content.trim() });
      setMsg("✅ 공지사항이 등록되었습니다.");
      setTitle("[공지] "); setContent("");
      onCreated();
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Field label="제목" required>
        <Input value={title} onChange={setTitle} className={INPUT_CLASS} />
      </Field>
      <Field label="내용" required>
        <Textarea value={content} onChange={setContent} rows={6} className={TEXTAREA_CLASS} />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}
