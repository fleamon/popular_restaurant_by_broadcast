"use client";

import { useEffect, useMemo, useState } from "react";
import { useKakaoLoader } from "react-kakao-maps-sdk";

import { api, type Channel, type MeResponse } from "@/lib/api";
import { geocode } from "@/lib/geocode";

import { Field, Input, extractYouTubeId } from "./_form";

// 검색 페이지(app/page.tsx) 와 동일한 카테고리 목록
const CUISINES: string[] = [
  "한식", "양식", "일식", "중식", "분식", "카페",
  "베이커리", "디저트", "아시안", "패스트푸드",
];

/** 맛집 입력 — admin/superadmin 공용.
 *  - admin: 자기 charge_channel 만 (배열 그대로 옵션으로 사용)
 *  - superadmin: 기존 모든 채널 + "+ 새 채널 직접 입력" 모드
 *  - superadmin: 추가로 "🌏 기존 좌표 보정" 버튼 노출
 */
export default function RestaurantInput({ me, channelsRevision }: { me: MeResponse; channelsRevision: number }) {
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

  // 좌표 일괄 보정 (superadmin 전용)
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  // channelsRevision 변경 시 채널 목록 재로드 — 회원관리에서 charge_channel 변경 즉시 반영
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
      setMsg(geo
        ? "✅ 추가되었습니다 (지도 좌표 자동 입력 완료)"
        : "⚠️ 추가됨 — 단 주소를 좌표로 변환하지 못해 지도에는 표시되지 않습니다"
      );
      setName(""); setAddress(""); setCuisine(""); setNaverUrl(""); setKakaoUrl("");
      setVideoUrl("");
      if (customMode) {
        setCustomChannel("");
        api.listChannels().then(setAllChannels).catch(() => {});
      }
    } catch (e) {
      setMsg("❌ 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  /** 좌표 비어있는 기존 맛집을 모두 geocoding → 일괄 PATCH. superadmin 전용. */
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
      setBackfillMsg(
        `✅ 완료 — 성공 ${ok}건, 실패 ${fail}건${fail > 0 ? " (주소를 카카오 지도에서 검색되도록 정리해주세요)" : ""}`,
      );
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

      {/* 좌표 일괄 보정 — superadmin 전용 */}
      {me.role === "superadmin" && (
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
      )}

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
