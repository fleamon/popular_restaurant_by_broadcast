"use client";

import { useEffect, useMemo, useState } from "react";
import { useKakaoLoader } from "react-kakao-maps-sdk";

import { api, type Channel, type MeResponse, type Restaurant, type UserUpdateBody } from "@/lib/api";
import { geocode } from "@/lib/geocode";
import { useMe } from "@/lib/me";
import { isAdmin, isSuperadmin } from "@/lib/role";

// 검색 페이지(app/page.tsx) 와 동일한 카테고리 목록
const CUISINES: string[] = [
  "한식", "양식", "일식", "중식", "분식", "카페",
  "베이커리", "디저트", "아시안", "패스트푸드",
];

export default function AdminPage() {
  const { me, loading } = useMe();
  // charge_channel 변경 시 RestaurantInput 의 채널 목록을 즉시 재로드하기 위한 키
  const [channelsRevision, setChannelsRevision] = useState(0);
  const bumpChannels = () => setChannelsRevision((v) => v + 1);
  // 한 번 admin 으로 검증되면 이후 재검사 스킵 (TOKEN_REFRESHED 등으로 me 가 깜빡 null 이 돼도 화면 유지)
  const [verifiedAdmin, setVerifiedAdmin] = useState(false);
  useEffect(() => {
    if (me && isAdmin(me)) setVerifiedAdmin(true);
  }, [me]);

  if (!verifiedAdmin) {
    if (loading) return <div className="text-sm font-bold text-neutral-500">권한 확인 중…</div>;
    if (!isAdmin(me)) return <div className="text-sm font-bold text-red-500">관리자만 접근할 수 있습니다.</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="font-soft text-3xl font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>DB 관리</h1>

      {isSuperadmin(me) && <UserManagement onChannelsChanged={bumpChannels} />}
      {me && <RestaurantInput me={me} channelsRevision={channelsRevision} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// (1) superadmin 전용 — 회원 관리
// ─────────────────────────────────────────────────────────────────────
type SaveResult = { email: string; before: string[]; after: string[] };

function UserManagement({ onChannelsChanged }: { onChannelsChanged: () => void }) {
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
    // 채널명 정규화: 좌우 공백 + 내부 공백 모두 제거. "맛있는 녀석들" === "맛있는녀석들"
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
function RestaurantInput({ me, channelsRevision }: { me: MeResponse; channelsRevision: number }) {
  // 카카오 SDK 로드 — services 라이브러리 포함 (Geocoder 사용)
  useKakaoLoader({ appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "", libraries: ["services"] });

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

  // 좌표 일괄 보정 상태
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  // channelsRevision 이 바뀔 때마다 채널 목록 재로드 — 회원관리에서 charge_channel 변경 즉시 반영
  useEffect(() => {
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
  }, [channelsRevision]);

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
      // 주소 → 좌표 변환 (실패해도 저장은 진행)
      const geo = await geocode(address);
      await api.createRestaurant({
        current_name: name,
        current_address: address,
        cuisine: cuisine || null,
        naver_map_url: naverUrl || null,
        kakao_map_url: kakaoUrl || null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        sido: geo?.sido ?? null,
        sigungu: geo?.sigungu ?? null,
        dong: geo?.dong ?? null,
        channels: [ch],
        source_url: videoUrl || null,
        youtube_video_id: extractYouTubeId(videoUrl),
      });
      setMsg(geo ? "✅ 추가되었습니다 (지도 좌표 자동 입력 완료)" : "⚠️ 추가됨 — 단 주소를 좌표로 변환하지 못해 지도에는 표시되지 않습니다");
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

  /** 좌표 비어있는 기존 맛집을 모두 geocoding 해서 일괄 PATCH. */
  async function runBackfill() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg("좌표 비어있는 맛집을 찾는 중…");
    try {
      const all = await api.listRestaurants({ limit: 1000 });
      const targets = all.filter((r) => r.lat == null || r.lng == null);
      if (targets.length === 0) {
        setBackfillMsg("✅ 보정 대상 없음 — 모든 맛집에 좌표가 있습니다");
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const r of targets) {
        setBackfillMsg(`보정 중… ${ok + fail + 1}/${targets.length} — ${r.current_name}`);
        const geo = await geocode(r.current_address);
        if (!geo) { fail++; continue; }
        try {
          await api.updateRestaurantGeo(r.id, geo);
          ok++;
        } catch {
          fail++;
        }
      }
      setBackfillMsg(`✅ 완료 — 성공 ${ok}건, 실패 ${fail}건${fail > 0 ? " (주소를 카카오 지도에서 검색되도록 정리해주세요)" : ""}`);
    } catch (e) {
      setBackfillMsg("❌ 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBackfilling(false);
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

      {/* 좌표 일괄 보정 — 좌표가 비어있는 기존 행을 카카오 Geocoder 로 채워 지도에 핀이 뜨도록 함 */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand bg-brand-surface p-3">
        <button
          type="button"
          onClick={runBackfill}
          disabled={backfilling}
          className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {backfilling ? "보정 중…" : "🌏 기존 좌표 보정"}
        </button>
        <span className="text-xs font-bold" style={{ color: "rgb(80 95 130)" }}>
          {backfillMsg ?? "lat/lng 가 비어있는 맛집을 카카오 지도 주소검색으로 일괄 채웁니다"}
        </span>
      </div>

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
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold focus:border-brand focus:outline-none"
            style={{ color: "rgb(20 30 80)" }}
          >
            <option value="">— 선택 —</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
