"use client";

import { useEffect, useMemo, useState } from "react";

import ChannelFilter from "@/components/ChannelFilter";
import Map from "@/components/Map";
import RegionSelect from "@/components/RegionSelect";
import { api, type Channel, type Restaurant } from "@/lib/api";

export default function SearchPage() {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [channelId, setChannelId] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rows, setRows] = useState<Restaurant[]>([]);

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">맛집 검색</h1>

      <div className="flex flex-wrap items-center gap-2">
        <RegionSelect value={sido} onChange={setSido} />
        <input
          placeholder="구/동 (예: 마포구)"
          value={sigungu}
          onChange={(e) => setSigungu(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <ChannelFilter channels={channels} value={channelId} onChange={setChannelId} />
        <input
          placeholder="가게 이름 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div className="text-sm text-neutral-500">검색 결과 {rows.length}곳</div>

      <div className="h-[68vh] overflow-hidden rounded-xl border border-neutral-200">
        <Map restaurants={rows} />
      </div>
    </div>
  );
}
