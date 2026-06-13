"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKakaoLoader } from "react-kakao-maps-sdk";

import {
  api,
  type AppearanceEditPayload,
  type Channel,
  type ManagedAppearance,
  type MeResponse,
} from "@/lib/api";
import { geocode } from "@/lib/geocode";
import { isSuperadmin } from "@/lib/role";

import { Field, Input, Textarea, extractYouTubeId } from "./_form";

const CUISINES = ["", "한식", "양식", "일식", "중식", "분식", "카페", "베이커리", "디저트", "아시안", "패스트푸드"];

/** 폼 한 화면이 다루는 필드 — restaurant + appearance 통합. */
type FormState = {
  current_name: string;
  current_address: string;
  cuisine: string;
  naver_map_url: string;
  kakao_map_url: string;
  phone: string;
  notes: string;
  source_url: string;
  youtube_video_id: string;
  episode_title: string;
};

const EMPTY_FORM: FormState = {
  current_name: "", current_address: "", cuisine: "",
  naver_map_url: "", kakao_map_url: "", phone: "", notes: "",
  source_url: "", youtube_video_id: "", episode_title: "",
};

/** initial vs current → 변경된 필드만 추출. 빈 문자열은 DB NULL 로 보냄. */
function diffPayload(initial: FormState, cur: FormState): AppearanceEditPayload {
  const restKeys: (keyof FormState)[] = [
    "current_name", "current_address", "cuisine",
    "naver_map_url", "kakao_map_url", "phone", "notes",
  ];
  const appKeys: (keyof FormState)[] = [
    "source_url", "youtube_video_id", "episode_title",
  ];
  const restaurant: Record<string, unknown> = {};
  const appearance: Record<string, unknown> = {};
  restKeys.forEach((k) => {
    if (initial[k] !== cur[k]) restaurant[k] = cur[k] === "" ? null : cur[k];
  });
  appKeys.forEach((k) => {
    if (initial[k] !== cur[k]) appearance[k] = cur[k] === "" ? null : cur[k];
  });
  const out: AppearanceEditPayload = {};
  if (Object.keys(restaurant).length) out.restaurant = restaurant;
  if (Object.keys(appearance).length) out.appearance = appearance;
  return out;
}

/** /admin '맛집/영상 관리' — 입력·수정·삭제 모두 한 화면.
 *  - 채널 선택 → 그 채널의 영상 목록 + 폼
 *  - 폼이 빈 상태일 땐 '신규 등록', 목록의 한 행을 클릭하면 그 영상 데이터로 폼이 채워지며 '수정 모드'
 *  - admin: 신규는 즉시 등록 / 수정·삭제는 요청만, superadmin: 모두 즉시
 */
export default function RestaurantManagement({ me, channelsRevision }: { me: MeResponse; channelsRevision: number }) {
  // 카카오 SDK — 주소→좌표 변환에 사용. JS 키가 없어도 폼 자체는 동작 (geo 없이 저장).
  useKakaoLoader({ appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "", libraries: ["services"] });

  const superadmin = isSuperadmin(me);

  // 채널 목록 — admin 은 charge_channel 만, superadmin 은 전체 + "새 채널 직접 입력"
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  useEffect(() => {
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
  }, [channelsRevision]);
  const channelOptions = useMemo<string[]>(() => {
    if (superadmin) return allChannels.map((c) => c.name);
    return me.charge_channel ?? [];
  }, [allChannels, me, superadmin]);

  // UI 상태
  const [selectedChannel, setSelectedChannel] = useState("");
  const [customMode, setCustomMode] = useState(false);  // superadmin 새 채널 입력 모드
  const [customChannel, setCustomChannel] = useState("");
  const [selectedAid, setSelectedAid] = useState<number | null>(null);  // null = 신규
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);  // 변경 감지 기준값
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 영상 목록 — 노출은 안 하고 datalist 옵션 + 가게 이름 일치 시 자동 populate 의 소스로만 사용
  const [allManaged, setAllManaged] = useState<ManagedAppearance[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    api.listManagedAppearances().then(setAllManaged).catch(() => setAllManaged([]));
  }, [reloadKey, channelsRevision]);

  // 선택된 채널이 channelOptions 에서 사라지면 (admin 의 charge_channel 변경 등) 초기화
  useEffect(() => {
    if (selectedChannel && !customMode && !channelOptions.includes(selectedChannel)) {
      setSelectedChannel("");
    }
  }, [channelOptions, selectedChannel, customMode]);

  // 기본 채널 자동 선택 — 진입 시 가게이름 입력 흐름으로 바로 들어가도록.
  //   - admin:      charge_channel 의 첫 채널
  //   - superadmin: 전체 채널 목록 중 첫 번째
  // 진입 후 사용자가 채널을 바꾸면 prevChannelRef cascade 로 폼 리셋됨.
  useEffect(() => {
    if (customMode) return;
    if (selectedChannel) return;
    if (channelOptions.length === 0) return;
    setSelectedChannel(channelOptions[0]);
  }, [customMode, selectedChannel, channelOptions]);

  // 채널 바뀌면 폼/선택 영상 리셋
  const prevChannelRef = useRef<string>("");
  useEffect(() => {
    if (prevChannelRef.current !== selectedChannel) {
      setSelectedAid(null);
      setInitial(EMPTY_FORM);
      setForm(EMPTY_FORM);
      setMsg(null);
      prevChannelRef.current = selectedChannel;
    }
  }, [selectedChannel]);

  // 현재 채널에 등록된 영상들 — 가게이름 datalist 옵션의 소스.
  // 비교는 공백 제거 정규화 — admin 의 charge_channel 표기("배달의 민족")가
  // DB 채널 이름 표기("배달의민족")와 공백 차이로 다를 수 있어서 (백엔드 _norm_channel 과 동일).
  const channelAppearances = useMemo(() => {
    if (!selectedChannel) return [] as ManagedAppearance[];
    const ch = customMode ? customChannel.trim() : selectedChannel;
    const norm = (s: string) => s.replace(/\s+/g, "");
    const target = norm(ch);
    return allManaged.filter((r) => r.channel_name && norm(r.channel_name) === target);
  }, [allManaged, selectedChannel, customMode, customChannel]);

  /** aid → getAppearance 로 풀데이터 받아 폼 채움. 가게이름 자동 일치 populate 에서 호출. */
  const loadAppearance = useCallback(async (aid: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.getAppearance(aid);
      const r = d.restaurants;
      const next: FormState = {
        current_name:     r.current_name ?? "",
        current_address:  r.current_address ?? "",
        cuisine:          r.cuisine ?? "",
        naver_map_url:    r.naver_map_url ?? "",
        kakao_map_url:    r.kakao_map_url ?? "",
        phone:            r.phone ?? "",
        notes:            r.notes ?? "",
        source_url:       d.source_url ?? "",
        youtube_video_id: d.youtube_video_id ?? "",
        episode_title:    d.episode_title ?? "",
      };
      setSelectedAid(aid);
      setInitial(next);
      setForm(next);
    } catch (e) {
      setMsg(`❌ 로딩 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // 가게 이름 자동 populate — 신규 모드 + 가게이름만 입력된 상태에서 옵션과 정확 일치하면
  // 그 영상으로 자동 로드 (수정 모드 진입).
  // 가드:
  //   - selectedAid !== null  → 이미 수정 모드 (가게이름 수정 의도일 수 있음)
  //   - 다른 필드가 비어있지 않음 → 사용자가 새 가게로 입력 중이라 덮어쓰지 않음
  useEffect(() => {
    if (selectedAid !== null) return;
    if (!form.current_name) return;
    const otherFilled = (Object.keys(EMPTY_FORM) as (keyof FormState)[])
      .some((k) => k !== "current_name" && form[k] !== EMPTY_FORM[k]);
    if (otherFilled) return;
    const match = channelAppearances.find((r) => r.restaurant_name === form.current_name);
    if (match) void loadAppearance(match.id);
  }, [form, channelAppearances, selectedAid, loadAppearance]);

  function resetToNew() {
    setSelectedAid(null);
    setInitial(EMPTY_FORM);
    setForm(EMPTY_FORM);
    setMsg(null);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function onVideoUrlChange(v: string) {
    const id = extractYouTubeId(v);
    setForm((p) => ({ ...p, source_url: v, youtube_video_id: id ?? p.youtube_video_id }));
  }

  const dirty = useMemo(() => JSON.stringify(initial) !== JSON.stringify(form), [initial, form]);

  // 채널 결정 — custom 모드(superadmin) 면 입력값, 아니면 select 값
  const activeChannel = customMode ? customChannel.trim() : selectedChannel;
  const channelReady = !!activeChannel;

  async function onSave() {
    if (!channelReady) {
      setMsg("❌ 채널을 먼저 선택하거나 입력하세요");
      return;
    }
    if (selectedAid === null) {
      // 신규 등록 — admin/superadmin 모두 즉시
      if (!form.current_name || !form.current_address) {
        setMsg("❌ 가게 이름·주소는 필수입니다");
        return;
      }
      setBusy(true);
      setMsg(null);
      try {
        const geo = await geocode(form.current_address);
        await api.createRestaurant({
          current_name:     form.current_name,
          current_address:  form.current_address,
          cuisine:          form.cuisine || null,
          naver_map_url:    form.naver_map_url || null,
          kakao_map_url:    form.kakao_map_url || null,
          phone:            form.phone || null,
          notes:            form.notes || null,
          lat:              geo?.lat ?? null,
          lng:              geo?.lng ?? null,
          sido:             geo?.sido ?? null,
          sigungu:          geo?.sigungu ?? null,
          dong:             geo?.dong ?? null,
          channels:         [activeChannel],
          source_url:       form.source_url || null,
          youtube_video_id: form.youtube_video_id || extractYouTubeId(form.source_url),
          episode_title:    form.episode_title || null,
        });
        setMsg(geo ? "✅ 등록됨 (좌표 자동 입력)" : "⚠️ 등록됨 — 좌표 변환 실패 (주소 형식 확인 권장)");
        resetToNew();
        bumpReload();
        if (customMode) { setCustomChannel(""); api.listChannels().then(setAllChannels).catch(() => {}); }
      } catch (e) {
        setMsg(`❌ 실패: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 수정 모드 — diff 만 추출
    const payload = diffPayload(initial, form);
    if (!payload.restaurant && !payload.appearance) {
      setMsg("변경된 값이 없습니다.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (superadmin) {
        await api.updateAppearanceNow(selectedAid, payload);
        setMsg("✅ 적용됨");
      } else {
        await api.createAppearanceEditRequest(selectedAid, payload);
        setMsg("✅ 수정 요청 등록됨 — superadmin 승인 대기");
      }
      bumpReload();
      // 적용 후엔 신규 모드로 — 같은 영상을 또 다루기 원하면 목록에서 다시 선택.
      resetToNew();
    } catch (e) {
      setMsg(`❌ 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (selectedAid === null) return;
    const msg2 = superadmin
      ? "이 영상을 영구 삭제합니다. 계속할까요?"
      : "삭제 요청을 superadmin 에게 보냅니다. 계속할까요?";
    if (!window.confirm(msg2)) return;
    let reason: string | null = null;
    if (!superadmin) reason = window.prompt("삭제 사유 (선택)") ?? null;
    setBusy(true);
    setMsg(null);
    try {
      if (superadmin) {
        await api.deleteAppearanceNow(selectedAid);
        setMsg("✅ 삭제됨");
      } else {
        await api.createAppearanceDeleteRequest(selectedAid, reason ?? undefined);
        setMsg("✅ 삭제 요청 등록됨 — superadmin 승인 대기");
      }
      bumpReload();
      resetToNew();
    } catch (e) {
      setMsg(`❌ 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // 좌표 일괄 보정 — superadmin 전용 (RestaurantInput 에서 이전)
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  async function runBackfill() {
    if (backfillBusy) return;
    setBackfillBusy(true);
    setBackfillMsg("좌표 비어있는 맛집을 찾는 중…");
    try {
      // limit=0 → 백엔드가 fetch_all 로 모든 맛집 누적 반환 (1000행 한도 우회)
      const all = await api.listRestaurants({ limit: 0 });
      const targets = all.filter((r) => r.lat == null || r.lng == null);
      if (targets.length === 0) { setBackfillMsg("✅ 보정 대상 없음"); return; }
      let ok = 0, fail = 0;
      for (const r of targets) {
        setBackfillMsg(`보정 중… ${ok + fail + 1}/${targets.length} — ${r.current_name}`);
        const geo = await geocode(r.current_address);
        if (!geo) { fail++; continue; }
        try { await api.updateRestaurantGeo(r.id, geo); ok++; } catch { fail++; }
      }
      setBackfillMsg(`✅ 완료 — 성공 ${ok}건, 실패 ${fail}건`);
    } catch (e) {
      setBackfillMsg(`❌ 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfillBusy(false);
    }
  }

  const mode = selectedAid === null ? "신규" : "수정";
  const saveLabel = selectedAid === null
    ? "📥 등록"
    : (superadmin ? "💾 저장" : "📩 수정 요청");
  const saveDisabled = busy
    || !channelReady
    || (selectedAid !== null && !dirty)
    || (selectedAid === null && (!form.current_name || !form.current_address));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-soft text-2xl font-bold" style={{ color: "rgb(20 30 80)" }}>맛집/영상 관리</h2>
        <p className="text-xs font-bold" style={{ color: "rgb(110 120 140)" }}>
          {superadmin
            ? "모든 채널에 신규 등록·수정·삭제 가능. 새 채널은 직접 입력 가능."
            : "관리 채널 만 노출됩니다. 신규 등록은 즉시, 수정·삭제는 superadmin 승인 후 반영."}
        </p>
      </header>

      {superadmin && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand bg-brand-surface p-3">
          <button
            type="button"
            onClick={() => void runBackfill()}
            disabled={backfillBusy}
            className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
          >
            {backfillBusy ? "보정 중…" : "🌏 기존 좌표 일괄 보정"}
          </button>
          <span className="text-xs font-bold" style={{ color: "rgb(80 95 130)" }}>
            {backfillMsg ?? "lat/lng 가 비어있는 맛집을 카카오 지도 주소검색으로 일괄 채웁니다."}
          </span>
        </div>
      )}

      {/* 채널 선택 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <Field label="채널" required>
          <div className="flex flex-wrap items-center gap-2">
            {!customMode ? (
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold focus:border-brand focus:outline-none"
                style={{ color: "rgb(20 30 80)" }}
              >
                <option value="">— 선택 —</option>
                {channelOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <Input
                value={customChannel}
                onChange={setCustomChannel}
                placeholder="새 채널 이름"
              />
            )}
            {superadmin && (
              <button
                type="button"
                onClick={() => {
                  setCustomMode((v) => !v);
                  setSelectedChannel("");
                  setCustomChannel("");
                }}
                className="text-xs font-bold underline"
                style={{ color: "rgb(43 127 255)" }}
              >
                {customMode ? "← 기존 채널 목록" : "+ 새 채널 직접 입력"}
              </button>
            )}
          </div>
        </Field>
      </div>

      {channelReady && (
        <>
          {/* 폼 — 신규/수정 통합. 수정 모드면 헤더에 영상 ID 표시 + '신규로 전환' 버튼 */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold" style={{ color: "rgb(20 30 80)" }}>
                {mode === "신규"
                  ? `'${activeChannel}' 에 새 맛집/영상 등록`
                  : `수정 중 — 영상 #${selectedAid}`}
              </h3>
              {mode === "수정" && (
                <button
                  type="button"
                  onClick={resetToNew}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                  title="신규 입력 모드로 전환"
                >
                  ✕ 신규로
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* 가게 이름 — datalist 자동완성. 옵션과 정확 일치하면 자동 populate(수정 모드 진입),
                  새 이름이면 그대로 신규 등록. */}
              <Field label="가게 이름" required hint="기존 가게는 자동 완성. 새 가게는 그대로 입력.">
                <input
                  list="dl-restaurant-name"
                  value={form.current_name}
                  onChange={(e) => update("current_name", e.target.value)}
                  placeholder="가게 이름을 입력 또는 선택"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
                />
                <datalist id="dl-restaurant-name">
                  {Array.from(new Set(channelAppearances.map((r) => r.restaurant_name).filter(Boolean) as string[])).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field label="주소" required hint="카카오 지도에서 검색되는 형식 권장">
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
              <Field label="전화">
                <Input value={form.phone} onChange={(v) => update("phone", v)} />
              </Field>
              <Field label="네이버 지도 URL">
                <Input value={form.naver_map_url} onChange={(v) => update("naver_map_url", v)} />
              </Field>
              <Field label="카카오 지도 URL">
                <Input value={form.kakao_map_url} onChange={(v) => update("kakao_map_url", v)} />
              </Field>
              <Field label="영상 URL">
                <Input value={form.source_url} onChange={onVideoUrlChange} />
              </Field>
              <Field label="영상 제목">
                <Input value={form.episode_title} onChange={(v) => update("episode_title", v)} />
              </Field>
              <Field label="메모·소개">
                <Textarea
                  value={form.notes}
                  onChange={(v) => update("notes", v)}
                  placeholder="가게 소개·특징 등 (상세 페이지에 그대로 노출 — 고유 콘텐츠가 되어 SEO 에 도움)"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saveDisabled}
                className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-40"
              >
                {saveLabel}
              </button>
              {mode === "수정" && (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  disabled={busy}
                  className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  {superadmin ? "🗑 삭제" : "🗑 삭제 요청"}
                </button>
              )}
              {msg && <span className="text-xs font-bold text-neutral-700">{msg}</span>}
            </div>
          </div>

        </>
      )}
    </section>
  );
}
