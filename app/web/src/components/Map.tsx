"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CustomOverlayMap,
  Map as KakaoMap,
  useKakaoLoader,
} from "react-kakao-maps-sdk";

import { api, type Appearance, type Channel, type Restaurant } from "@/lib/api";

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울특별시청
const DEFAULT_LEVEL = 8;

// 함수 이름을 'Map' 으로 두면 본문 내 `new Map()` 이 글로벌 Map 대신 자기 자신을 가리킨다.
// 이 충돌을 피하기 위해 함수 이름은 RestaurantMap, default export 는 그대로 유지.
export default function RestaurantMap({ restaurants, center = DEFAULT_CENTER }: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const [loading, error] = useKakaoLoader({ appkey, libraries: ["services"] });

  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [topApps, setTopApps] = useState<Appearance[]>([]);
  const [busy, setBusy] = useState(false);

  // 핀 표시용 채널 썸네일을 한 번에 로드해 매핑.
  const [channelThumbs, setChannelThumbs] = useState<Map<number, string>>(new Map());
  // restaurant_id → channel_id (대표 채널) 매핑
  const [restaurantChannel, setRestaurantChannel] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    api.listChannels().then((channels: Channel[]) => {
      const m = new Map<number, string>();
      channels.forEach((c) => { if (c.thumbnail_url) m.set(c.id, c.thumbnail_url); });
      setChannelThumbs(m);
    }).catch(() => {});
  }, []);

  // 각 restaurant 의 대표 appearance(채널) 로드 — 핀 색깔/이미지 매핑
  useEffect(() => {
    const ids = restaurants.map((r) => r.id);
    if (ids.length === 0) {
      setRestaurantChannel(new Map());
      return;
    }
    // 너무 많으면 부담 — 100개로 제한
    const limited = ids.slice(0, 100);
    Promise.all(limited.map((id) => api.topAppearance(id).catch(() => null))).then((apps) => {
      const m = new Map<number, number>();
      apps.forEach((a) => { if (a) m.set(a.restaurant_id, a.channel_id); });
      setRestaurantChannel(m);
    });
  }, [restaurants]);

  function handlePinClick(r: Restaurant) {
    setSelected(r);
    setTopApps([]);
    setBusy(true);
    api.topAppearances(r.id)
      .then((apps) => setTopApps(apps))
      .catch(() => setTopApps([]))   // FastAPI 미가동/네트워크 오류 시 unhandled rejection 방지
      .finally(() => setBusy(false));
  }

  if (!appkey) return <Status title="지도 키 미설정" detail="NEXT_PUBLIC_KAKAO_JS_KEY 설정 필요" />;
  if (error)   return <Status title="지도 SDK 로드 실패" detail="키 또는 도메인 등록 확인" />;
  if (loading) return <Status title="지도 로딩 중…" />;

  const pinnable = restaurants.filter((r) => r.lat != null && r.lng != null);

  return (
    <div className="relative h-full w-full">
      <KakaoMap center={center} level={DEFAULT_LEVEL} style={{ width: "100%", height: "100%" }}>
        {pinnable.map((r) => {
          const channelId = restaurantChannel.get(r.id);
          const thumb = channelId ? channelThumbs.get(channelId) : null;
          return (
            <CustomOverlayMap
              key={r.id}
              position={{ lat: r.lat as number, lng: r.lng as number }}
              yAnchor={1}
            >
              <ChannelPin thumb={thumb} onClick={() => handlePinClick(r)} />
            </CustomOverlayMap>
          );
        })}
      </KakaoMap>

      {selected && (
        <PinModal
          restaurant={selected}
          appearances={topApps}
          loading={busy}
          onClose={() => { setSelected(null); setTopApps([]); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 채널 썸네일 핀 — 둥근 마커 + 채널 대표 이미지
// ─────────────────────────────────────────────────────────────────────
function ChannelPin({ thumb, onClick }: { thumb: string | null | undefined; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative -translate-y-2"
      aria-label="맛집 보기"
    >
      <div className="h-10 w-10 rounded-full border-2 border-brand bg-white shadow-md overflow-hidden transition-transform group-hover:scale-110">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-brand text-brand-fg text-xs font-bold">●</div>
        )}
      </div>
      {/* 핀 꼬리 */}
      <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-brand" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 핀 클릭 오버레이 모달 — 음식점 정보 + 좋아요 최다 영상 2개
// ─────────────────────────────────────────────────────────────────────
function PinModal({
  restaurant,
  appearances,
  loading,
  onClose,
}: {
  restaurant: Restaurant;
  appearances: Appearance[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 z-10 w-[320px] rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      >
        ×
      </button>
      <div className="p-4">
        <div className="text-base font-bold text-brand">{restaurant.current_name}</div>
        <div className="mt-1 text-xs text-neutral-500">{restaurant.current_address}</div>
        <div className="mt-3 flex gap-2">
          <a
            href={restaurant.naver_map_url ?? `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.current_name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-md bg-[#03C75A] px-3 py-1.5 text-center text-xs font-bold text-white hover:opacity-90"
          >
            네이버지도
          </a>
          <a
            href={restaurant.kakao_map_url ?? `https://map.kakao.com/?q=${encodeURIComponent(restaurant.current_name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-md bg-[#FEE500] px-3 py-1.5 text-center text-xs font-bold text-black hover:opacity-90"
          >
            다음지도
            {restaurant.kakao_rating ? <span className="ml-1">⭐ {restaurant.kakao_rating.toFixed(1)}</span> : null}
          </a>
        </div>
      </div>

      <div className="border-t border-neutral-100">
        {loading ? (
          <p className="p-4 text-xs text-neutral-400">대표 영상 불러오는 중…</p>
        ) : appearances.length === 0 ? (
          <p className="p-4 text-xs text-neutral-400">아직 등록된 영상이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {appearances.map((a) => <VideoRow key={a.id} app={a} />)}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-100 p-3 text-center">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="inline-block w-full rounded-md bg-brand px-3 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover"
        >
          자세히 보기 →
        </Link>
      </div>
    </div>
  );
}

function VideoRow({ app }: { app: Appearance }) {
  const url = app.source_url ?? (app.youtube_video_id ? `https://www.youtube.com/watch?v=${app.youtube_video_id}` : null);
  const Wrap = url
    ? ({ children }: { children: React.ReactNode }) => (
        <a href={url} target="_blank" rel="noreferrer" className="block hover:bg-brand-surface">
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return (
    <li>
      <Wrap>
        <div className="flex gap-3 p-3">
          {app.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.thumbnail_url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
          ) : (
            <div className="h-14 w-20 shrink-0 rounded bg-neutral-100" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-neutral-500 truncate">
              {app.channels?.name ?? "—"}
            </div>
            <div className="text-sm font-bold text-neutral-900 line-clamp-2">
              {app.episode_title ?? "에피소드"}
            </div>
            <div className="text-xs text-neutral-400">
              👍 {app.likes ?? 0}
            </div>
          </div>
        </div>
      </Wrap>
    </li>
  );
}

function Status({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-neutral-50 p-6 text-center">
      <div>
        <p className="font-bold text-neutral-700">{title}</p>
        {detail && <p className="mt-2 max-w-md text-xs text-neutral-500">{detail}</p>}
      </div>
    </div>
  );
}
