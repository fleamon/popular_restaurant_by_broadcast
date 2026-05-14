"use client";

import { useEffect, useState } from "react";

import Pagination from "@/components/Pagination";
import { api, type MeResponse, type UserUpdateBody } from "@/lib/api";

type SaveResult = { email: string; before: string[]; after: string[] };

const PAGE_SIZE = 5;

/** superadmin 전용 — 회원 관리. email/nickname 검색 + 페이지네이션 + role/charge_channel/차단 변경. */
export default function UserManagement({ onChannelsChanged }: { onChannelsChanged: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MeResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [savedModal, setSavedModal] = useState<SaveResult | null>(null);

  function reload() {
    api.listUsers(q, page, PAGE_SIZE)
      .then((res) => { setRows(res.data); setTotal(res.total); })
      .catch(() => { setRows([]); setTotal(0); });
  }

  useEffect(() => {
    const t = setTimeout(reload, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  async function patch(seq: number, body: UserUpdateBody) {
    await api.updateUser(seq, body);
    reload();
  }

  /** charge_channel 저장 시 before/after 모달 + 부모(맛집입력)에게 채널 갱신 신호 */
  async function patchCharge(user: MeResponse, after: string[]) {
    const before = user.charge_channel ?? [];
    await api.updateUser(user.sequence, { charge_channel: after });
    setSavedModal({ email: user.email, before, after });
    reload();
    onChannelsChanged();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-3">
      <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>회원 관리</h2>
      <input
        placeholder="email 또는 닉네임 검색"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        className="w-full max-w-sm rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
      />
      <div className="overflow-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead style={{ background: "rgb(245 247 252)" }}>
            <tr>
              {["#", "email", "nickname", "role", "charge_channel", "actions"].map((h) => (
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
            {rows.map((u) => (
              <UserRow key={u.sequence} user={u} onPatch={patch} onPatchCharge={patchCharge} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "rgb(150 160 180)" }}>결과 없음</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} totalCount={total} />

      {savedModal && <SavedModal result={savedModal} onClose={() => setSavedModal(null)} />}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 회원 한 행 — role select + charge_channel 편집 + 차단 토글
// ─────────────────────────────────────────────────────────────────────
function UserRow({
  user,
  onPatch,
  onPatchCharge,
}: {
  user: MeResponse;
  onPatch: (s: number, b: UserUpdateBody) => Promise<void>;
  onPatchCharge: (u: MeResponse, after: string[]) => Promise<void>;
}) {
  const [chargeText, setChargeText] = useState((user.charge_channel ?? []).join(", "));

  useEffect(() => {
    setChargeText((user.charge_channel ?? []).join(", "));
  }, [user.charge_channel]);

  function saveCharge() {
    const normalize = (s: string) => s.replace(/\s+/g, "");
    const arr = chargeText.split(",").map((s) => s.trim()).filter(Boolean).map(normalize).filter(Boolean);
    const dedupe = Array.from(new Set(arr));
    if (dedupe.length !== arr.length) {
      alert("중복된 채널 이름이 있습니다 (공백 무시 비교). 이전 값으로 되돌립니다.");
      setChargeText((user.charge_channel ?? []).join(", "));
      return;
    }
    void onPatchCharge(user, dedupe);
  }

  const roleColor =
    user.role === "superadmin" ? "rgb(140 50 180)" :
    user.role === "admin"      ? "rgb(43 127 255)" :
                                  "rgb(80 95 130)";

  return (
    <tr className="hover:bg-brand-surface">
      <td className="px-3 py-2 font-mono text-xs" style={{ color: "rgb(110 120 140)" }}>{user.sequence}</td>
      <td className="px-3 py-2 font-mono text-xs" style={{ color: "rgb(20 30 80)" }}>
        {user.email}
        {user.is_blocked && (
          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">BLOCKED</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm" style={{ color: "rgb(20 30 80)" }}>{user.nickname}</td>
      <td className="px-3 py-2">
        <select
          value={user.role}
          onChange={(e) => void onPatch(user.sequence, { role: e.target.value as never })}
          className="rounded border px-2 py-1 text-sm font-bold"
          style={{ color: roleColor }}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            value={chargeText}
            onChange={(e) => setChargeText(e.target.value)}
            placeholder="채널1, 채널2"
            className="min-w-[200px] rounded border px-2 py-1 text-sm font-bold"
            style={{ color: "rgb(20 30 80)" }}
          />
          <button onClick={saveCharge} className="rounded bg-brand px-2 py-1 text-xs font-bold text-brand-fg">
            저장
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => void onPatch(user.sequence, { is_blocked: !user.is_blocked })}
          className={[
            "rounded px-2 py-1 text-xs font-bold",
            user.is_blocked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {user.is_blocked ? "차단 해제" : "차단"}
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────
// charge_channel 저장 결과 모달 — before/after 비교
// ─────────────────────────────────────────────────────────────────────
function SavedModal({ result, onClose }: { result: SaveResult; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-green-100 text-green-700">✓</span>
          <h3 className="font-soft text-lg font-bold text-brand">저장 완료</h3>
        </div>
        <p className="mb-4 text-sm font-bold text-neutral-600">{result.email} 의 charge_channel</p>

        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-bold text-neutral-500">이전 값</div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs">
              {result.before.length === 0 ? <span className="text-neutral-400">(빈 배열)</span> : result.before.join(", ")}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-brand">현재 값</div>
            <div className="rounded-md border border-brand bg-brand-surface p-2 font-mono text-xs">
              {result.after.length === 0 ? <span className="text-neutral-400">(빈 배열)</span> : result.after.join(", ")}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-brand px-4 py-2 font-bold text-brand-fg hover:bg-brand-hover"
        >
          확인
        </button>
      </div>
    </div>
  );
}
