"use client";

import { useEffect, useState } from "react";
import { Map as KakaoMap, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

import type { Restaurant } from "@/lib/api";

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
};

// 대한민국 중앙(대전 근처) 기본 중심점
const DEFAULT_CENTER = { lat: 36.3504, lng: 127.3845 };

export default function Map({ restaurants, center = DEFAULT_CENTER }: Props) {
  const [loading] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "",
    libraries: ["services"],
  });
  const [hovered, setHovered] = useState<Restaurant | null>(null);

  // 지도에 표시 가능한 위경도가 있는 항목만 남김(함수형 필터).
  const pinnable = restaurants.filter((r) => r.lat != null && r.lng != null);

  if (loading) return <div className="h-full w-full grid place-items-center text-neutral-500">지도 로딩 중…</div>;

  return (
    <div className="relative h-full w-full">
      <KakaoMap
        center={center}
        level={12}
        style={{ width: "100%", height: "100%" }}
      >
        {pinnable.map((r) => (
          <MapMarker
            key={r.id}
            position={{ lat: r.lat as number, lng: r.lng as number }}
            onMouseOver={() => setHovered(r)}
            onMouseOut={() => setHovered((h) => (h?.id === r.id ? null : h))}
          />
        ))}
      </KakaoMap>

      {hovered && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg bg-white p-3 shadow-lg ring-1 ring-neutral-200">
          <div className="text-base font-semibold text-brand">{hovered.current_name}</div>
          <div className="text-sm text-neutral-600">{hovered.current_address}</div>
          {hovered.cuisine && <div className="text-xs mt-1 text-neutral-500">{hovered.cuisine}</div>}
          {typeof hovered.likes === "number" && (
            <div className="text-xs mt-1 text-neutral-500">👍 {hovered.likes} · 👎 {hovered.dislikes ?? 0}</div>
          )}
        </div>
      )}
    </div>
  );
}
