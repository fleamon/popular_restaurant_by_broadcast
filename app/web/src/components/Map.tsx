"use client";

import { useState } from "react";
import { Map as KakaoMap, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

import type { Restaurant } from "@/lib/api";

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
};

// 기본 중심점: 서울특별시청
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_LEVEL = 8; // 서울 도심 ~ 외곽까지 보이는 줌

export default function Map({ restaurants, center = DEFAULT_CENTER }: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const [loading, error] = useKakaoLoader({
    appkey,
    libraries: ["services"],
  });
  const [hovered, setHovered] = useState<Restaurant | null>(null);

  // 위경도가 있는 항목만 핀으로 표시(함수형 필터).
  const pinnable = restaurants.filter((r) => r.lat != null && r.lng != null);

  if (!appkey) return <Status title="지도 키 미설정" detail="app/web/.env.local 의 NEXT_PUBLIC_KAKAO_JS_KEY 를 채워주세요. (Kakao Developers → 앱 → JavaScript 키)" />;
  if (error)   return <Status title="지도 SDK 로드 실패" detail="키가 유효한지, Kakao Developers > Web 플랫폼에 http://localhost:3000 가 등록되어 있는지 확인하세요." />;
  if (loading) return <Status title="지도 로딩 중…" />;

  return (
    <div className="relative h-full w-full">
      <KakaoMap center={center} level={DEFAULT_LEVEL} style={{ width: "100%", height: "100%" }}>
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
          {hovered.cuisine && <div className="mt-1 text-xs text-neutral-500">{hovered.cuisine}</div>}
          {typeof hovered.likes === "number" && (
            <div className="mt-1 text-xs text-neutral-500">👍 {hovered.likes} · 👎 {hovered.dislikes ?? 0}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Status({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-neutral-50 p-6 text-center">
      <div>
        <p className="font-medium text-neutral-700">{title}</p>
        {detail && <p className="mt-2 max-w-md text-xs text-neutral-500">{detail}</p>}
      </div>
    </div>
  );
}
