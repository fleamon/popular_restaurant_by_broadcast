"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CustomOverlayMap,
  Map as KakaoMap,
  useKakaoLoader,
} from "react-kakao-maps-sdk";

import { api, type Appearance, type Restaurant } from "@/lib/api";

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function ytThumbUrl(id: string | null, size: "default" | "mqdefault" | "hqdefault" = "mqdefault"): string | null {
  return id ? `https://img.youtube.com/vi/${id}/${size}.jpg` : null;
}

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
  level?: number;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울특별시청
// 카카오 지도 level — 작을수록 확대. 8(과거) → 5 (3단계 확대).
const DEFAULT_LEVEL = 4;

// 함수 이름을 'Map' 으로 두면 본문 내 `new Map()` 이 글로벌 Map 대신 자기 자신을 가리킨다.
// 이 충돌을 피하기 위해 함수 이름은 RestaurantMap, default export 는 그대로 유지.
export default function RestaurantMap({ restaurants, center = DEFAULT_CENTER, level = DEFAULT_LEVEL }: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const [loading, error] = useKakaoLoader({ appkey, libraries: ["services"] });

  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [topApps, setTopApps] = useState<Appearance[]>([]);
  const [busy, setBusy] = useState(false);

  // restaurant_id → 대표 appearance 의 핀 표시 정보(채널 썸네일 + 채널명 첫글자)
  type RepInfo = { channelName: string; channelThumb: string | null };
  const [restaurantRep, setRestaurantRep] = useState<Map<number, RepInfo>>(new Map());

  useEffect(() => {
    const ids = restaurants.map((r) => r.id);
    if (ids.length === 0) {
      setRestaurantRep(new Map());
      return;
    }
    let cancelled = false;
    // batch 엔드포인트 — N개 식당의 대표 appearance(채널 정보 포함) 를 1번 호출로 받기.
    // 과거 N번 병렬 호출 방식은 일부 실패로 핀 썸네일 누락 발생.
    api.topAppearancesBatch(ids.slice(0, 500))
      .then((map) => {
        if (cancelled) return;
        const m = new Map<number, RepInfo>();
        Object.entries(map).forEach(([rid, a]) => {
          m.set(Number(rid), {
            channelName: a.channels?.name ?? "",
            channelThumb: a.channels?.thumbnail_url ?? null,
          });
        });
        setRestaurantRep(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
      <KakaoMap center={center} level={level} style={{ width: "100%", height: "100%" }}>
        {pinnable.map((r) => {
          const rep = restaurantRep.get(r.id);
          const thumb = rep?.channelThumb ?? null;
          const letter = rep?.channelName?.trim()?.[0] ?? null;
          return (
            <CustomOverlayMap
              key={r.id}
              position={{ lat: r.lat as number, lng: r.lng as number }}
              yAnchor={1}
            >
              <ChannelPin thumb={thumb} letter={letter} onClick={() => handlePinClick(r)} />
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
function ChannelPin({
  thumb,
  letter,
  onClick,
}: {
  thumb: string | null | undefined;
  letter: string | null;
  onClick: () => void;
}) {
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
        ) : letter ? (
          <div className="grid h-full w-full place-items-center bg-brand text-brand-fg text-base font-bold">{letter}</div>
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
  const ytId = app.youtube_video_id ?? extractYouTubeId(app.source_url);
  const url = app.source_url ?? (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
  // 자세히보기 페이지의 YouTube 임베드와 동일한 영상의 썸네일을 사용.
  const thumb = app.thumbnail_url ?? ytThumbUrl(ytId, "mqdefault");
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
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
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
