"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  api,
  type AppearanceDetail,
  type AppearanceEditPayload,
  type Channel,
  type ManagedAppearance,
  type MeResponse,
} from "@/lib/api";
import { isSuperadmin } from "@/lib/role";

import { Field, Input, extractYouTubeId } from "./_form";

const CUISINES = ["", "한식", "양식", "일식", "중식", "분식", "카페", "베이커리", "디저트", "아시안", "패스트푸드"];

type FormState = {
  // restaurant 부분
  current_name: string;
  current_address: string;
  cuisine: string;
  naver_map_url: string;
  kakao_map_url: string;
  phone: string;
  notes: string;
  // appearance 부분
  channel_id: number | "";
  source_url: string;
  youtube_video_id: string;
  episode_title: string;
};

function detailToForm(d: AppearanceDetail): FormState {
  const r = d.restaurants;
  return {
    current_name:     r.current_name ?? "",
    current_address:  r.current_address ?? "",
    cuisine:          r.cuisine ?? "",
    naver_map_url:    r.naver_map_url ?? "",
    kakao_map_url:    r.kakao_map_url ?? "",
    phone:            r.phone ?? "",
    notes:            r.notes ?? "",
    channel_id:       d.channel_id,
    source_url:       d.source_url ?? "",
    youtube_video_id: d.youtube_video_id ?? "",
    episode_title:    d.episode_title ?? "",
  };
}

/** initial 과 current 를 비교해 restaurant/appearance 변경분 추출. 값이 같으면 그 키 제외. */
function diffPayload(initial: FormState, cur: FormState): AppearanceEditPayload {
  const restMap: Record<keyof FormState, "restaurant" | "appearance"> = {
    current_name: "restaurant", current_address: "restaurant", cuisine: "restaurant",
    naver_map_url: "restaurant", kakao_map_url: "restaurant", phone: "restaurant", notes: "restaurant",
    channel_id: "appearance", source_url: "appearance", youtube_video_id: "appearance", episode_title: "appearance",
  };
  const restaurant: Record<string, unknown> = {};
  const appearance: Record<string, unknown> = {};
  (Object.keys(initial) as (keyof FormState)[]).forEach((k) => {
    if (initial[k] !== cur[k]) {
      // 빈 문자열은 DB null 로 보냄 (단, 필수 필드는 빈값 전송 안 함 — 백엔드에서 거를 수도)
      const v = cur[k] === "" ? null : cur[k];
      if (restMap[k] === "restaurant") restaurant[k] = v;
      else appearance[k] = v;
    }
  });
  const out: AppearanceEditPayload = {};
  if (Object.keys(restaurant).length) out.restaurant = restaurant;
  if (Object.keys(appearance).length) out.appearance = appearance;
  return out;
}

/** db관리 탭 — 영상(appearance) 단위로 맛집 정보를 수정·삭제.
 *  admin: 본인 charge_channel 영상만, 요청만 가능. superadmin: 전체, 즉시 적용.
 */
export default function RestaurantManagement({ me, channelsRevision }: { me: MeResponse; channelsRevision: number }) {
  const superadmin = isSuperadmin(me);
  const [list, setList] = useState<ManagedAppearance[]>([]);
  const [q, setQ] = useState("");
  const [expandedAid, setExpandedAid] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    api.listManagedAppearances()
      .then((rows) => setList(rows))
      .catch(() => setList([]));
  }, [reloadKey, channelsRevision]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => {
      const hay = [r.restaurant_name, r.restaurant_address, r.channel_name, r.episode_title]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [list, q]);

  return (
    <section className="space-y-3">
      <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>맛집/영상 관리</h2>
      <p className="text-xs font-bold" style={{ color: "rgb(110 120 140)" }}>
        {superadmin
          ? "모든 영상에 대해 즉시 수정·삭제가 가능합니다."
          : "본인 charge_channel 채널의 영상만 보입니다. 수정·삭제는 superadmin 승인 후 반영됩니다."}
      </p>

      <input
        placeholder="맛집 이름 / 주소 / 채널 / 영상 제목 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none"
      />

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm font-bold text-neutral-400">대상 영상이 없습니다.</li>
        )}
        {filtered.map((row) => (
          <li key={row.id} className="py-2">
            <button
              type="button"
              onClick={() => setExpandedAid((cur) => (cur === row.id ? null : row.id))}
              className="flex w-full items-start justify-between gap-3 px-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                  {row.restaurant_name ?? "(이름 없음)"}
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-neutral-500">
                  {row.restaurant_address ?? "—"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {row.channel_name && (
                    <span className="rounded-md bg-brand-surface px-1.5 py-0.5 font-bold leading-none text-brand">
                      📺 {row.channel_name}
                    </span>
                  )}
                  {row.episode_title && (
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold leading-none text-neutral-700 truncate max-w-[420px]">
                      🎬 {row.episode_title}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-neutral-400">{expandedAid === row.id ? "▲" : "▼"}</span>
            </button>
            {expandedAid === row.id && (
              <EditPanel
                aid={row.id}
                me={me}
                superadmin={superadmin}
                onChanged={() => { reload(); setExpandedAid(null); }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 펼쳐진 행의 수정 폼. mount 시 getAppearance() 로 풀데이터 받아 폼 초기화. */
function EditPanel({
  aid, me, superadmin, onChanged,
}: {
  aid: number;
  me: MeResponse;
  superadmin: boolean;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AppearanceDetail | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getAppearance(aid).then((d) => {
      setDetail(d);
      const f = detailToForm(d);
      setInitial(f);
      setForm(f);
    }).catch((e) => setMsg(`로딩 실패: ${e instanceof Error ? e.message : String(e)}`));
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
  }, [aid]);

  // admin 의 채널 옵션 — charge_channel 이름과 매칭되는 채널만
  const channelOptions = useMemo(() => {
    if (superadmin) return allChannels;
    const norm = (s: string) => s.replace(/\s+/g, "");
    const allowed = new Set((me.charge_channel ?? []).map(norm));
    return allChannels.filter((c) => allowed.has(norm(c.name)));
  }, [allChannels, me, superadmin]);

  const dirty = useMemo(() => {
    if (!initial || !form) return false;
    return JSON.stringify(initial) !== JSON.stringify(form);
  }, [initial, form]);

  if (!form || !initial || !detail) {
    return <div className="px-3 py-3 text-xs font-bold text-neutral-400">{msg ?? "불러오는 중…"}</div>;
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // 영상 URL 변경 시 youtube_video_id 자동 채움
  function onVideoUrlChange(v: string) {
    const id = extractYouTubeId(v);
    setForm((prev) => (prev ? { ...prev, source_url: v, youtube_video_id: id ?? prev.youtube_video_id } : prev));
  }

  async function onSaveOrRequest() {
    if (!form || !initial) return;
    const payload = diffPayload(initial, form);
    if (!payload.restaurant && !payload.appearance) {
      setMsg("변경된 값이 없습니다.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (superadmin) {
        await api.updateAppearanceNow(aid, payload);
        setMsg("✅ 적용됨");
      } else {
        await api.createAppearanceEditRequest(aid, payload);
        setMsg("✅ 수정 요청 등록됨 — superadmin 승인 대기");
      }
      onChanged();
    } catch (e) {
      setMsg(`실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const msg2 = superadmin
      ? "이 영상을 영구 삭제합니다. 계속할까요?"
      : "삭제 요청을 superadmin 에게 보냅니다. 계속할까요?";
    if (!window.confirm(msg2)) return;
    let reason: string | null = null;
    if (!superadmin) {
      reason = window.prompt("삭제 사유 (선택)") ?? null;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (superadmin) {
        await api.deleteAppearanceNow(aid);
        setMsg("✅ 삭제됨");
      } else {
        await api.createAppearanceDeleteRequest(aid, reason ?? undefined);
        setMsg("✅ 삭제 요청 등록됨 — superadmin 승인 대기");
      }
      onChanged();
    } catch (e) {
      setMsg(`실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 grid gap-3 border-t border-neutral-100 bg-neutral-50 p-3 sm:grid-cols-2">
      <Field label="가게 이름" required>
        <Input value={form.current_name} onChange={(v) => update("current_name", v)} />
      </Field>
      <Field label="주소" required>
        <Input value={form.current_address} onChange={(v) => update("current_address", v)} />
      </Field>
      <Field label="카테고리">
        <select
          value={form.cuisine}
          onChange={(e) => update("cuisine", e.target.value)}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
        >
          {CUISINES.map((c) => <option key={c} value={c}>{c || "(없음)"}</option>)}
        </select>
      </Field>
      <Field label="채널">
        <select
          value={form.channel_id}
          onChange={(e) => update("channel_id", e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
        >
          {channelOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="네이버 지도 URL">
        <Input value={form.naver_map_url} onChange={(v) => update("naver_map_url", v)} />
      </Field>
      <Field label="카카오 지도 URL">
        <Input value={form.kakao_map_url} onChange={(v) => update("kakao_map_url", v)} />
      </Field>
      <Field label="전화">
        <Input value={form.phone} onChange={(v) => update("phone", v)} />
      </Field>
      <Field label="메모">
        <Input value={form.notes} onChange={(v) => update("notes", v)} />
      </Field>
      <Field label="영상 URL">
        <Input value={form.source_url} onChange={onVideoUrlChange} />
      </Field>
      <Field label="영상 제목">
        <Input value={form.episode_title} onChange={(v) => update("episode_title", v)} />
      </Field>

      <div className="col-span-full flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => void onSaveOrRequest()}
          disabled={busy || !dirty}
          className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-40"
        >
          {superadmin ? "💾 저장" : "📩 수정 요청"}
        </button>
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={busy}
          className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          {superadmin ? "🗑 삭제" : "🗑 삭제 요청"}
        </button>
        {msg && <span className="text-xs font-bold text-neutral-700">{msg}</span>}
      </div>
    </div>
  );
}
