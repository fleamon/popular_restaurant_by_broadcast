"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import ChannelFilter from "@/components/ChannelFilter";
import Map from "@/components/Map";
import RegionSelect from "@/components/RegionSelect";
import RestaurantGrid from "@/components/RestaurantGrid";
import RestaurantList from "@/components/RestaurantList";
import ViewToggle, { type SearchView } from "@/components/ViewToggle";
import { api, type Channel, type Restaurant } from "@/lib/api";

const COUNT_COLOR = "rgb(90 97 106)"; // R:90 G:97 B:106 — 결과 카운트 전용

export default function HomePage() {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [channelId, setChannelId] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [view, setView] = useState<SearchView>("map");

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  const params = useMemo(
    () => ({ sido, sigungu, channel_id: channelId === "" ? undefined : channelId, q }),
    [sido, sigungu, channelId, q],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      api.listRestaurants(params).then(setRows).catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [params]);

  function triggerSearch() {
    api.listRestaurants(params).then(setRows).catch(() => setRows([]));
  }

  return (
    <div>
      {/* 헤더 라인: 제목 + 결과 개수 + 보기 모드 */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">맛집 검색</h1>
          <span
            className="font-soft text-base font-bold tracking-tight"
            style={{ color: COUNT_COLOR }}
          >
            결과 {rows.length} 개
          </span>
        </div>
        <div className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* 필터 라인 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RegionSelect value={sido} onChange={setSido} />
        <input
          placeholder="구/동 (예: 마포구)"
          value={sigungu}
          onChange={(e) => setSigungu(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
        />
        <ChannelFilter channels={channels} value={channelId} onChange={setChannelId} />
        <input
          placeholder="가게 이름 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
          className="min-w-[220px] flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={triggerSearch}
          aria-label="검색"
          title="검색"
          className="relative h-11 w-11 shrink-0 rounded-md hover:bg-brand-surface transition-colors"
        >
          <Image src="/icon-search.png" alt="" fill sizes="44px" className="object-contain" />
        </button>
      </div>

      {/* 결과 영역 */}
      {view === "map" && (
        <div className="h-[68vh] overflow-hidden rounded-xl border border-neutral-200">
          <Map restaurants={rows} />
        </div>
      )}
      {view === "list" && <RestaurantList rows={rows} />}
      {view === "grid" && <RestaurantGrid rows={rows} />}
    </div>
  );
}
