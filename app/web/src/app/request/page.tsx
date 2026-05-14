"use client";

import { useEffect, useState } from "react";

import Pagination from "@/components/Pagination";
import {
  api,
  NOTICE_STYLE,
  REQUEST_TYPE_LABEL,
  type Channel,
  type RequestComment,
  type RequestDetail,
  type RequestStatus,
  type RequestSummary,
  type RequestType,
} from "@/lib/api";
import { useMe } from "@/lib/me";
import { isSuperadmin } from "@/lib/role";

const REQUESTS_PAGE_SIZE = 10;

const BASE_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: "channel_add",   label: "채널 추가요청" },
  { value: "admin_request", label: "관리자 요청" },
  { value: "bug",           label: "버그 제보" },
  { value: "etc",           label: "기타 요청" },
];
const NOTICE_OPTION: { value: RequestType; label: string } = { value: "notice", label: "공지사항" };

const STATUSES: RequestStatus[] = ["요청", "처리중", "완료", "반려"];

const STATUS_STYLE: Record<RequestStatus, { color: string; bg: string }> = {
  "요청":   { color: "rgb(80 95 130)",   bg: "rgb(245 247 252)" },
  "처리중": { color: "rgb(43 127 255)",  bg: "rgb(235 244 255)" },
  "완료":   { color: "rgb(20 130 60)",   bg: "rgb(232 248 238)" },
  "반려":   { color: "rgb(200 40 40)",   bg: "rgb(254 235 235)" },
};

export default function RequestPage() {
  const { me } = useMe();
  const loggedIn = !!me;
  const superadmin = isSuperadmin(me);

  const [rows, setRows] = useState<RequestSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.listRequests().then(setRows).catch(() => setRows([]));
  }, [reloadKey]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">요청 게시판</h1>

      {!loggedIn && (
        <p className="rounded-xl border border-dashed border-brand bg-brand-surface p-4 text-sm font-bold text-brand">
          로그인하면 요청 글(채널 추가요청, 관리자 요청, 버그 제보, 기타 요청)을 작성할 수 있습니다.
        </p>
      )}

      {loggedIn && (
        <RequestForm
          superadmin={superadmin}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      )}

      <RequestListSection
        rows={rows}
        loggedIn={loggedIn}
        superadmin={superadmin}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// 작성 폼 — 라디오로 타입 선택 + 타입별 입력 필드
// ───────────────────────────────────────────────────────────────────
function RequestForm({ superadmin, onCreated }: { superadmin: boolean; onCreated: () => void }) {
  const [type, setType] = useState<RequestType>("channel_add");
  // superadmin 만 '공지사항' 라디오가 보이고, superadmin 이 아닌 경우 type 이 'notice' 가 될 일 없음.
  const TYPE_OPTIONS = superadmin ? [...BASE_TYPE_OPTIONS, NOTICE_OPTION] : BASE_TYPE_OPTIONS;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-soft text-xl font-bold text-brand">요청 작성</h2>

      <div className="flex flex-wrap gap-3 text-sm">
        {TYPE_OPTIONS.map((t) => (
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

      {type === "channel_add"   && <ChannelAddForm onCreated={onCreated} />}
      {type === "admin_request" && <AdminRequestForm onCreated={onCreated} />}
      {type === "bug"           && <SimpleForm type="bug" onCreated={onCreated} />}
      {type === "etc"           && <SimpleForm type="etc" onCreated={onCreated} />}
      {type === "notice"        && <NoticeForm onCreated={onCreated} />}
    </section>
  );
}

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
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} />
      </Field>
      <Field label="내용" required>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className={TEXTAREA_CLS}
        />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

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
        <select value={channelType} onChange={(e) => setChannelType(e.target.value as never)} className={SELECT_CLS}>
          <option value="tv">TV</option>
          <option value="youtube">YouTube</option>
          <option value="blog">Blog</option>
          <option value="other">기타</option>
        </select>
      </Field>
      <Field label="제목" required hint={`${title.length}/100`}>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} className={INPUT_CLS} />
      </Field>
      <Field label="채널 URL" required hint={`${url.length}/200`}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value.slice(0, 200))}
          placeholder="https://www.youtube.com/@..."
          className={INPUT_CLS}
        />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

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
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} className={INPUT_CLS} />
      </Field>
      <Field label="관리요청 채널" required>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value === "" ? "" : Number(e.target.value))}
          className={SELECT_CLS}
        >
          <option value="">— 선택 —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="내용" required hint={`${content.length}/200`}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 200))}
          rows={4}
          className={TEXTAREA_CLS}
        />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

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
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} className={INPUT_CLS} />
      </Field>
      <Field label="내용" required hint={`${content.length}/200`}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 200))}
          rows={4}
          className={TEXTAREA_CLS}
        />
      </Field>
      <SubmitRow busy={busy} msg={msg} onSubmit={submit} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// 목록 + 펼치기
// ───────────────────────────────────────────────────────────────────
function RequestListSection({
  rows, loggedIn, superadmin, expandedId, onToggle, onChanged,
}: {
  rows: RequestSummary[];
  loggedIn: boolean;
  superadmin: boolean;
  expandedId: number | null;
  onToggle: (id: number) => void;
  onChanged: () => void;
}) {
  // 공지사항은 항상 최상단 (백엔드에서 이미 정렬되어 옴) + 10개씩 페이지네이션
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
        <div className="flex items-center gap-3 text-xs font-bold">
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
        {visible.map((r) => {
          const expanded = expandedId === r.id;
          // 공지사항은 비로그인 포함 누구나 본문 열람. 그 외 타입은 로그인+작성자/superadmin 만.
          const canOpen = r.type === "notice" || (loggedIn && (r.is_mine || superadmin));
          const isNotice = r.type === "notice";
          return (
            <li
              key={r.id}
              style={isNotice ? { background: NOTICE_STYLE.bg } : undefined}
            >
              <div className="flex items-stretch">
                {/* 다중 선택 checkbox — superadmin 만 노출 */}
                {superadmin && (
                  <label className="flex shrink-0 cursor-pointer items-center pl-3 pr-1">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSel(r.id)}
                      className="accent-brand"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => { if (canOpen) onToggle(r.id); }}
                  disabled={!canOpen}
                  className={[
                    "flex flex-1 items-center gap-3 px-4 py-3 text-left",
                    canOpen ? "cursor-pointer hover:bg-brand-surface" : "cursor-not-allowed",
                  ].join(" ")}
                  title={canOpen ? "" : "작성자 또는 superadmin 만 내용을 볼 수 있습니다"}
                >
                  <TypeChip type={r.type} />
                  <span
                    className="font-soft flex-1 truncate text-sm font-bold"
                    style={{ color: isNotice ? NOTICE_STYLE.color : "rgb(20 30 80)" }}
                  >
                    {r.title}
                  </span>
                  {r.is_mine && (
                    <span className="shrink-0 rounded bg-brand-surface px-1.5 py-0.5 text-[10px] font-bold text-brand">내 글</span>
                  )}
                  {!isNotice && <StatusChip status={r.status} />}
                  <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">
                    {formatDate(r.created_at)}
                  </span>
                </button>
              </div>
              {expanded && canOpen && <RequestDetailPanel rid={r.id} onChanged={onChanged} />}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-8 text-center text-sm font-bold text-neutral-400">아직 요청이 없습니다.</li>
        )}
      </ul>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} totalCount={rows.length} />
    </section>
  );
}

function RequestDetailPanel({ rid, onChanged }: { rid: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    api.getRequest(rid).then(setDetail).catch(() => setDetail(null));
    api.listRequestComments(rid).then(setComments).catch(() => setComments([]));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.createRequestComment(rid, reply.trim());
      setReply("");
      reload();
    } catch (e) {
      alert("댓글 작성 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  async function changeStatus(s: RequestStatus) {
    try {
      await api.updateRequestStatus(rid, s);
      reload();
      onChanged();
    } catch (e) {
      alert("상태 변경 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removeRequest() {
    if (!window.confirm("이 요청 글을 삭제할까요? 댓글도 함께 삭제됩니다.")) return;
    try {
      await api.deleteRequest(rid);
      onChanged();   // 부모가 목록 reload — 삭제된 행 사라짐
    } catch (e) {
      alert("삭제 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function grantChannel() {
    if (!detail) return;
    const channelLabel = detail.channel_name ?? "(채널)";
    const userLabel = detail.author_nickname ?? "(요청자)";
    if (!window.confirm(
      `'${userLabel}' 회원의 charge_channel 에 '${channelLabel}' 을 추가하고 role 이 user 면 admin 으로 승격합니다. 계속할까요?`
    )) return;
    try {
      const r = await api.grantRequestChannel(rid);
      const lines = [
        r.added ? `✅ '${r.channel}' 추가됨` : `ℹ '${r.channel}' 은 이미 charge_channel 에 있어 변경 없음`,
        r.role_upgraded ? "✅ role: user → admin 승격" : "",
      ].filter(Boolean);
      alert(lines.join("\n"));
    } catch (e) {
      alert("부여 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  if (!detail) {
    return (
      <div className="border-t border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-400">불러오는 중…</div>
    );
  }

  const isNotice = detail.type === "notice";
  // 삭제 권한 — 본인(글 작성자) 또는 superadmin. 다중 삭제는 superadmin 만(목록 헤더).
  const canDelete = detail.is_mine || detail.can_manage;

  return (
    <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-neutral-700">
          작성자: <span className="text-neutral-900">{detail.author_nickname ?? "—"}</span>
        </span>
        <div className="flex items-center gap-2">
          {/* 상태 — 공지사항은 상태값 없음(노출 X), 그 외는 superadmin 만 select, 일반은 chip */}
          {!isNotice && (
            detail.can_manage ? (
              <select
                value={detail.status}
                onChange={(e) => void changeStatus(e.target.value as RequestStatus)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-bold"
                style={{ color: STATUS_STYLE[detail.status].color }}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <StatusChip status={detail.status} />
            )
          )}
          {detail.can_manage && detail.type === "admin_request" && detail.channel_id && (
            <button
              type="button"
              onClick={() => void grantChannel()}
              className="rounded-md border border-brand bg-white px-2 py-1 text-xs font-bold text-brand hover:bg-brand-surface"
              title="요청자에게 이 채널 권한 부여 (charge_channel 추가 + role 'admin' 승격)"
            >
              ✅ 채널 권한 부여
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => void removeRequest()}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
              title="요청 삭제"
            >
              🗑 삭제
            </button>
          )}
        </div>
      </div>

      <DetailBody detail={detail} />

      {/* 대화 — 공지사항은 표시 X. 그 외 타입에서 작성자/superadmin 만 보임. */}
      {!isNotice && (
        <div>
          <div className="mb-2 text-xs font-bold text-neutral-500">대화</div>
          <ul className="space-y-2">
            {comments.map((c) => {
              const isSuper = c.author_role === "superadmin";
              return (
                <li key={c.id} className={`flex ${isSuper ? "justify-start" : "justify-end"}`}>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      isSuper ? "border border-neutral-200 bg-white" : "bg-brand text-brand-fg",
                    ].join(" ")}
                  >
                    <div className={`mb-0.5 text-[10px] font-bold ${isSuper ? "text-neutral-500" : "text-brand-fg/80"}`}>
                      {c.author_nickname ?? "—"}
                      {isSuper && <span className="ml-1 rounded bg-brand/10 px-1 text-brand">관리자</span>}
                    </div>
                    <div className="whitespace-pre-line">{c.body}</div>
                  </div>
                </li>
              );
            })}
            {comments.length === 0 && (
              <li className="rounded-md border border-dashed border-neutral-200 p-3 text-center text-xs text-neutral-400">
                아직 대화가 없습니다.
              </li>
            )}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 100))}
              placeholder="답변 (최대 100자)"
              className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold"
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) void sendReply(); }}
            />
            <button
              onClick={() => void sendReply()}
              disabled={busy || !reply.trim()}
              className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg disabled:opacity-50"
            >
              전송
            </button>
          </div>
          <div className="mt-1 text-right text-[10px] text-neutral-400">{reply.length}/100</div>
        </div>
      )}
    </div>
  );
}

function DetailBody({ detail }: { detail: RequestDetail }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (detail.type === "channel_add") {
    rows.push({ label: "채널 타입", value: detail.channel_type ?? "—" });
    rows.push({
      label: "채널 URL",
      value: detail.channel_url
        ? <a href={detail.channel_url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{detail.channel_url}</a>
        : "—",
    });
  } else if (detail.type === "admin_request") {
    rows.push({ label: "관리요청 채널", value: detail.channel_name ?? "—" });
    rows.push({ label: "내용", value: <span className="whitespace-pre-line">{detail.content ?? "—"}</span> });
  } else {
    rows.push({ label: "내용", value: <span className="whitespace-pre-line">{detail.content ?? "—"}</span> });
  }
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
      <dl className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs font-bold text-neutral-500">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-neutral-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// 공용 작은 컴포넌트
// ───────────────────────────────────────────────────────────────────
const SELECT_CLS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";
const INPUT_CLS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";
const TEXTAREA_CLS =
  "w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-bold">
        <span style={{ color: "rgb(20 30 80)" }}>
          {label} {required && <span style={{ color: "rgb(200 40 40)" }}>*</span>}
        </span>
        {hint && <span className="font-normal text-neutral-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SubmitRow({ busy, msg, onSubmit }: { busy: boolean; msg: string | null; onSubmit: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs font-bold ${msg?.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>
      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "등록 중…" : "요청 등록"}
      </button>
    </div>
  );
}

function TypeChip({ type }: { type: RequestType }) {
  const isNotice = type === "notice";
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={isNotice
        ? { color: NOTICE_STYLE.color, background: "rgb(252 230 170)" }
        : { color: "rgb(75 85 99)", background: "rgb(243 244 246)" }}
    >
      {REQUEST_TYPE_LABEL[type]}
    </span>
  );
}

function StatusChip({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold leading-none"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
