"use client";

import { useState } from "react";
import { Map as KakaoMap, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

import { api, type Appearance, type Restaurant } from "@/lib/api";

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
};

// 기본 중심점: 서울특별시청
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_LEVEL = 8;

export default function Map({ restaurants, center = DEFAULT_CENTER }: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const [loading, error] = useKakaoLoader({ appkey, libraries: ["services"] });

  // 마우스오버: 빠른 미리보기 / 클릭: 대표 영상 카드 로드
  const [hovered, setHovered] = useState<Restaurant | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [topApp, setTopApp] = useState<Appearance | null>(null);
  const [loadingApp, setLoadingApp] = useState(false);

  const pinnable = restaurants.filter((r) => r.lat != null && r.lng != null);

  function handlePinClick(r: Restaurant) {
    setSelected(r);
    setTopApp(null);
    setLoadingApp(true);
    api.topAppearance(r.id)
      .then((data) => setTopApp(data))
      .catch(() => setTopApp(null))
      .finally(() => setLoadingApp(false));
  }

  if (!appkey) return <Status title="지도 키 미설정" detail="app/web/.env.local 의 NEXT_PUBLIC_KAKAO_JS_KEY 를 채워주세요." />;
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
            onClick={() => handlePinClick(r)}
          />
        ))}
      </KakaoMap>

      {/* 호버 미리보기 (왼쪽 위) */}
      {hovered && !selected && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg bg-white p-3 shadow-lg ring-1 ring-neutral-200">
          <div className="text-base font-bold text-brand">{hovered.current_name}</div>
          <div className="text-sm text-neutral-600">{hovered.current_address}</div>
          {hovered.cuisine && <div className="mt-1 text-xs text-neutral-500">{hovered.cuisine}</div>}
        </div>
      )}

      {/* 클릭 시 대표 회차/영상 카드 (오른쪽 위) */}
      {selected && (
        <AppearanceCard
          restaurant={selected}
          appearance={topApp}
          loading={loadingApp}
          onClose={() => {
            setSelected(null);
            setTopApp(null);
          }}
        />
      )}
    </div>
  );
}

function AppearanceCard({
  restaurant,
  appearance,
  loading,
  onClose,
}: {
  restaurant: Restaurant;
  appearance: Appearance | null;
  loading: boolean;
  onClose: () => void;
}) {
  const url = appearance?.source_url ?? null;
  const channelName = appearance?.channels?.name ?? "—";
  const Wrapper = url
    ? ({ children }: { children: React.ReactNode }) => (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return (
    <div className="absolute right-4 top-4 max-w-sm rounded-xl bg-white p-4 shadow-xl ring-1 ring-neutral-200">
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
      >
        ×
      </button>

      <Wrapper>
        <div className="pr-6">
          <div className="text-xs font-bold text-neutral-500">{channelName}</div>
          <div className="mt-1 text-base font-bold text-brand">{restaurant.current_name}</div>
          <div className="text-xs text-neutral-500">{restaurant.current_address}</div>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-neutral-400">대표 영상 불러오는 중…</p>
        ) : appearance ? (
          <div className="mt-3 space-y-1.5">
            {appearance.episode_title && (
              <div className="text-sm font-bold text-neutral-800">{appearance.episode_title}</div>
            )}
            {appearance.summary && (
              <p className="text-xs text-neutral-600 line-clamp-3">{appearance.summary}</p>
            )}
            {appearance.aired_at && (
              <div className="text-xs text-neutral-400">방영 {appearance.aired_at}</div>
            )}
            {url && (
              <div className="pt-1 text-sm font-bold text-brand">영상/원본 보기 →</div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-400">아직 등록된 방영 정보가 없습니다.</p>
        )}
      </Wrapper>
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
