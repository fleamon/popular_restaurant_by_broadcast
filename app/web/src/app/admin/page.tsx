"use client";

import { useEffect, useMemo, useState } from "react";

import { api, type Channel, type MeResponse, type UserUpdateBody } from "@/lib/api";
import { useMe } from "@/lib/me";
import { isAdmin, isSuperadmin } from "@/lib/role";

export default function AdminPage() {
  const { me, loading } = useMe();

  if (loading) return <div className="text-sm font-bold text-neutral-500">권한 확인 중…</div>;
  if (!isAdmin(me)) return <div className="text-sm font-bold text-red-500">관리자만 접근할 수 있습니다.</div>;

  return (
    <div className="space-y-8">
      <h1 className="font-soft text-3xl font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>DB 관리</h1>

      {isSuperadmin(me) && <UserManagement />}
      <RestaurantInput me={me!} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// (1) superadmin 전용 — 회원 관리
// ─────────────────────────────────────────────────────────────────────
type SaveResult = { email: string; before: string[]; after: string[] };

function UserManagement() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MeResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [savedModal, setSavedModal] = useState<SaveResult | null>(null);
  const PAGE_SIZE = 20;

  function reload() {
    api.listUsers(q, page, PAGE_SIZE)
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
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

  /** charge_channel 저장 시 before/after 모달 표시 */
  async function patchCharge(user: MeResponse, after: string[]) {
    const before = user.charge_channel ?? [];
    await api.updateUser(user.sequence, { charge_channel: after });
    setSavedModal({ email: user.email, before, after });
    reload();
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
                <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider"
                    style={{ color: "rgb(80 95 130)" }}>
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
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded border px-3 py-1 font-bold disabled:opacity-50"
          style={{ color: "rgb(20 30 80)" }}
        >
          ◀ 이전
        </button>
        <span className="font-bold" style={{ color: "rgb(20 30 80)" }}>
          {page} / {totalPages} <span style={{ color: "rgb(110 120 140)" }}>(총 {total})</span>
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded border px-3 py-1 font-bold disabled:opacity-50"
          style={{ color: "rgb(20 30 80)" }}
        >
          다음 ▶
        </button>
      </div>

      {savedModal && (
        <SavedModal result={savedModal} onClose={() => setSavedModal(null)} />
      )}
    </section>
  );
}

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

  // 외부에서 user.charge_channel 이 새로 로드되면 입력란 동기화
  useEffect(() => {
    setChargeText((user.charge_channel ?? []).join(", "));
  }, [user.charge_channel]);

  function saveCharge() {
    const arr = chargeText.split(",").map((s) => s.trim()).filter(Boolean);
    void onPatchCharge(user, arr);
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
// charge_channel 저장 결과 모달
// ─────────────────────────────────────────────────────────────────────
function SavedModal({ result, onClose }: { result: SaveResult; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      >
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

// ─────────────────────────────────────────────────────────────────────
// (2) 맛집 입력 — admin/superadmin
//   - admin: 자기 charge_channel 만 (배열 그대로 옵션으로 사용)
//   - superadmin: 기존 모든 채널 + "+ 새 채널 직접 입력" 모드
// ─────────────────────────────────────────────────────────────────────
function RestaurantInput({ me }: { me: MeResponse }) {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [channelName, setChannelName] = useState("");
  const [customMode, setCustomMode] = useState(false);  // superadmin 새 채널 모드
  const [customChannel, setCustomChannel] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [naverUrl, setNaverUrl] = useState("");
  const [kakaoUrl, setKakaoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
  }, []);

  // 채널 옵션:
  //   - admin: charge_channel 배열 그대로 (DB 미존재여도 OK — 백엔드가 자동 생성)
  //   - superadmin: 등록된 모든 채널 이름
  const channelOptions = useMemo<string[]>(() => {
    if (me.role === "superadmin") return allChannels.map((c) => c.name);
    return me.charge_channel ?? [];
  }, [allChannels, me]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const ch = customMode ? customChannel.trim() : channelName;
    if (!ch) {
      setMsg("❌ 채널을 선택하거나 입력하세요");
      setBusy(false);
      return;
    }

    try {
      await api.createRestaurant({
        current_name: name,
        current_address: address,
        cuisine: cuisine || null,
        naver_map_url: naverUrl || null,
        kakao_map_url: kakaoUrl || null,
        channels: [ch],
        source_url: videoUrl || null,
        youtube_video_id: extractYouTubeId(videoUrl),
      });
      setMsg("✅ 추가되었습니다");
      setName(""); setAddress(""); setCuisine(""); setNaverUrl(""); setKakaoUrl("");
      setVideoUrl("");
      if (customMode) {
        setCustomChannel("");
        // 새 채널이 DB 에 추가됐을 테니 목록 새로고침
        api.listChannels().then(setAllChannels).catch(() => {});
      }
    } catch (e) {
      setMsg("❌ 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>맛집 입력</h2>
      <p className="text-sm font-bold" style={{ color: "rgb(110 120 140)" }}>
        {me.role === "admin"
          ? `관리 채널: ${(me.charge_channel ?? []).join(", ") || "(없음 — superadmin 에게 charge_channel 설정을 요청하세요)"}`
          : "superadmin 은 모든 채널에 등록할 수 있고, 필요하면 새 채널을 즉시 추가할 수 있습니다."}
      </p>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <Field label="채널" required>
          <div className="space-y-2">
            {!customMode ? (
              <select
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold focus:border-brand focus:outline-none"
                style={{ color: "rgb(20 30 80)" }}
              >
                <option value="">— 선택 —</option>
                {channelOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <Input
                value={customChannel}
                onChange={setCustomChannel}
                placeholder="새 채널 이름 (예: 맛있는 녀석들)"
                required
              />
            )}

            {/* superadmin 만 새 채널 직접 입력 토글 */}
            {me.role === "superadmin" && (
              <button
                type="button"
                onClick={() => { setCustomMode((v) => !v); setChannelName(""); setCustomChannel(""); }}
                className="text-xs font-bold underline"
                style={{ color: "rgb(43 127 255)" }}
              >
                {customMode ? "← 기존 채널 목록으로" : "+ 새 채널 직접 입력"}
              </button>
            )}
          </div>
        </Field>

        <Field label="가게 이름" required>
          <Input value={name} onChange={setName} required />
        </Field>
        <Field label="주소" required hint="네이버/카카오 지도에서 검색되는 형식 권장">
          <Input value={address} onChange={setAddress} required />
        </Field>
        <Field label="카테고리">
          <Input value={cuisine} onChange={setCuisine} placeholder="한식 / 일식 / 중식 / …" />
        </Field>
        <Field label="네이버 지도 URL" hint="https://map.naver.com/...">
          <Input value={naverUrl} onChange={setNaverUrl} placeholder="https://map.naver.com/..." />
        </Field>
        <Field label="카카오 지도 URL" hint="https://map.kakao.com/...">
          <Input value={kakaoUrl} onChange={setKakaoUrl} placeholder="https://map.kakao.com/..." />
        </Field>
        <Field label="영상 URL" hint="YouTube / 네이버TV / 블로그 등 어떤 플랫폼 URL 도 OK">
          <Input value={videoUrl} onChange={setVideoUrl} placeholder="https://www.youtube.com/watch?v=..." />
        </Field>

        {msg && (
          <p
            className="text-sm font-bold"
            style={{ color: msg.startsWith("✅") ? "rgb(20 130 60)" : "rgb(200 40 40)" }}
          >
            {msg}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand px-4 py-2.5 font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "등록 중…" : "맛집 등록"}
        </button>
      </form>
    </section>
  );
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm font-bold">
        <span style={{ color: "rgb(20 30 80)" }}>
          {label} {required && <span style={{ color: "rgb(200 40 40)" }}>*</span>}
        </span>
        {hint && <span className="font-normal" style={{ color: "rgb(150 160 180)" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
    />
  );
}
