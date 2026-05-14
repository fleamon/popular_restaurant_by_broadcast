"use client";

import { useEffect, useState } from "react";

import { api, type RequestComment, type RequestDetail, type RequestStatus } from "@/lib/api";

import { StatusChip } from "./chips";
import { STATUSES, STATUS_STYLE } from "./constants";

/** 펼친 상세 패널 — 작성자/상태 헤더 + 본문 + (notice 가 아니면) 대화. */
export default function RequestDetailPanel({
  rid,
  onChanged,
}: {
  rid: number;
  onChanged: () => void;
}) {
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
      onChanged();
    } catch (e) {
      alert("삭제 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function grantChannel() {
    if (!detail) return;
    const channelLabel = detail.channel_name ?? "(채널)";
    const userLabel = detail.author_nickname ?? "(요청자)";
    if (!window.confirm(
      `'${userLabel}' 회원의 charge_channel 에 '${channelLabel}' 을 추가하고 role 이 user 면 admin 으로 승격합니다. 계속할까요?`,
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
    return <div className="border-t border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-400">불러오는 중…</div>;
  }

  const isNotice = detail.type === "notice";
  const canDelete = detail.is_mine || detail.can_manage;

  return (
    <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-neutral-700">
          작성자: <span className="text-neutral-900">{detail.author_nickname ?? "—"}</span>
        </span>
        <div className="flex items-center gap-2">
          {/* 공지사항은 상태값 없음(노출 X), 그 외는 superadmin 만 select */}
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
        <Conversation
          comments={comments}
          reply={reply}
          busy={busy}
          onChange={setReply}
          onSend={sendReply}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 타입별 본문 — dl 로 키/값 목록. URL 은 링크.
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// 카톡 스타일 대화 — superadmin 좌측 흰 버블, 작성자 우측 brand 버블
// ─────────────────────────────────────────────────────────────────────
function Conversation({
  comments,
  reply,
  busy,
  onChange,
  onSend,
}: {
  comments: RequestComment[];
  reply: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
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
          onChange={(e) => onChange(e.target.value.slice(0, 100))}
          placeholder="답변 (최대 100자)"
          className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold"
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) void onSend(); }}
        />
        <button
          onClick={() => void onSend()}
          disabled={busy || !reply.trim()}
          className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg disabled:opacity-50"
        >
          전송
        </button>
      </div>
      <div className="mt-1 text-right text-[10px] text-neutral-400">{reply.length}/100</div>
    </div>
  );
}
