"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CustomOverlayMap,
  Map as KakaoMap,
  useKakaoLoader,
} from "react-kakao-maps-sdk";

import VoteButton from "@/components/VoteButton";
import { api, type Appearance, type Restaurant } from "@/lib/api";

type MyVotes = Record<string, 1 | -1>;
type VoteState = { likes: number; dislikes: number; myVote: 1 | -1 | null };

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

  // 투표 상태 — 타입별 (target_id → {likes, dislikes, myVote}).
  // 같은 채널이 여러 영상에 등장해도 모든 VoteButton 인스턴스가 동일 source 에서 읽음 → 한 곳 클릭 시 다른 곳도 동기화.
  const [voteR, setVoteR] = useState<Record<number, VoteState>>({});
  const [voteC, setVoteC] = useState<Record<number, VoteState>>({});
  const [voteA, setVoteA] = useState<Record<number, VoteState>>({});

  // 페이지 마운트 시 내 투표 한 번에 fetch (3 타입). 비로그인은 401 → 빈 객체.
  useEffect(() => {
    const mergeMy = (setter: typeof setVoteR) => (mv: MyVotes) => {
      setter((prev) => {
        const next = { ...prev };
        for (const [idStr, v] of Object.entries(mv)) {
          const id = Number(idStr);
          next[id] = { likes: prev[id]?.likes ?? 0, dislikes: prev[id]?.dislikes ?? 0, myVote: v };
        }
        return next;
      });
    };
    api.myVotes("restaurant").then(mergeMy(setVoteR)).catch(() => {});
    api.myVotes("channel").then(mergeMy(setVoteC)).catch(() => {});
    api.myVotes("appearance").then(mergeMy(setVoteA)).catch(() => {});
  }, []);

  // restaurant_id → 대표 appearance 의 핀 표시 정보(채널 썸네일 + 채널명 첫글자)
  type RepInfo = { channelName: string; channelThumb: string | null };
  const [restaurantRep, setRestaurantRep] = useState<Map<number, RepInfo>>(new Map());

  useEffect(() => {
    // 지도에 실제로 표시될 핀(좌표 있는 것)만 대상 — 누락 없게 끝까지 처리.
    const ids = restaurants.filter((r) => r.lat != null && r.lng != null).map((r) => r.id);
    if (ids.length === 0) {
      setRestaurantRep(new Map());
      return;
    }
    let cancelled = false;
    // 1000개 IDs 를 한 번에 IN 절로 보내도 무난하지만,
    // 안전하게 200 청크씩 병렬 호출 → 결과 누적. 한 청크 실패해도 다른 청크는 살아남음.
    const CHUNK = 200;
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

    Promise.all(chunks.map((c) => api.topAppearancesBatch(c).catch(() => ({}) as Record<string, import("@/lib/api").Appearance>)))
      .then((results) => {
        if (cancelled) return;
        const m = new Map<number, RepInfo>();
        for (const r of results) {
          for (const [rid, a] of Object.entries(r)) {
            m.set(Number(rid), {
              channelName: a.channels?.name ?? "",
              channelThumb: a.channels?.thumbnail_url ?? null,
            });
          }
        }
        setRestaurantRep(m);
      });
    return () => { cancelled = true; };
  }, [restaurants]);

  function handlePinClick(r: Restaurant) {
    setSelected(r);
    setTopApps([]);
    setBusy(true);

    // 식당 score 가 없으면 단건 fetch 해서 카운터 정확히 표시
    api.getRestaurant(r.id).then((rest) => {
      if (!rest) return;
      setVoteR((prev) => ({
        ...prev,
        [r.id]: {
          likes: rest.likes ?? 0,
          dislikes: rest.dislikes ?? 0,
          myVote: prev[r.id]?.myVote ?? null,  // 내 투표는 마운트 시 받은 값 유지
        },
      }));
    }).catch(() => {});

    api.topAppearances(r.id)
      .then((apps) => {
        setTopApps(apps);
        // 영상/채널 score 를 vote state 에 반영. myVote 는 기존 유지.
        setVoteA((prev) => {
          const next = { ...prev };
          for (const a of apps) {
            next[a.id] = {
              likes: a.likes ?? 0,
              dislikes: a.dislikes ?? 0,
              myVote: prev[a.id]?.myVote ?? null,
            };
          }
          return next;
        });
        setVoteC((prev) => {
          const next = { ...prev };
          for (const a of apps) {
            if (!a.channel_id) continue;
            next[a.channel_id] = {
              likes: a.channels?.likes ?? 0,
              dislikes: a.channels?.dislikes ?? 0,
              myVote: prev[a.channel_id]?.myVote ?? null,
            };
          }
          return next;
        });
      })
      .catch(() => setTopApps([]))   // FastAPI 미가동/네트워크 오류 시 unhandled rejection 방지
      .finally(() => setBusy(false));
  }

  if (!appkey) return <Status title="지도 키 미설정" detail="NEXT_PUBLIC_KAKAO_JS_KEY 설정 필요" />;
  if (error)   return <Status title="지도 SDK 로드 실패" detail="키 또는 도메인 등록 확인" />;
  if (loading) return <Status title="지도 로딩 중…" />;

  const pinnable = restaurants.filter((r) => r.lat != null && r.lng != null);

  return (
    <div className="relative h-full w-full">
      <KakaoMap
        center={center}
        level={level}
        style={{ width: "100%", height: "100%" }}
        // 지도 배경(핀이 아닌 영역) 클릭 시 열린 모달 닫기. 핀 클릭은 CustomOverlay 의 React onClick 이 잡으니 영향 없음.
        onClick={() => setSelected(null)}
      >
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
          voteR={voteR}
          voteC={voteC}
          voteA={voteA}
          setVoteR={setVoteR}
          setVoteC={setVoteC}
          setVoteA={setVoteA}
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
type VoteMap = Record<number, VoteState>;
type VoteMapSetter = React.Dispatch<React.SetStateAction<VoteMap>>;

function PinModal({
  restaurant,
  appearances,
  loading,
  onClose,
  voteR,
  voteC,
  voteA,
  setVoteR,
  setVoteC,
  setVoteA,
}: {
  restaurant: Restaurant;
  appearances: Appearance[];
  loading: boolean;
  onClose: () => void;
  voteR: VoteMap;
  voteC: VoteMap;
  voteA: VoteMap;
  setVoteR: VoteMapSetter;
  setVoteC: VoteMapSetter;
  setVoteA: VoteMapSetter;
}) {
  const rState = voteR[restaurant.id] ?? { likes: restaurant.likes ?? 0, dislikes: restaurant.dislikes ?? 0, myVote: null };
  return (
    <div className="absolute right-4 top-4 z-10 w-[340px] rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      >
        ×
      </button>
      <div className="p-4 pr-10">
        <div className="text-base font-bold text-brand">{restaurant.current_name}</div>
        <div className="mt-1 text-xs text-neutral-500">{restaurant.current_address}</div>
        {/* 식당 투표 */}
        <div className="mt-2">
          <VoteButton
            target_type="restaurant"
            target_id={restaurant.id}
            initialLikes={rState.likes}
            initialDislikes={rState.dislikes}
            initialMyVote={rState.myVote}
            onChange={(next) => setVoteR((prev) => ({ ...prev, [restaurant.id]: next }))}
          />
        </div>
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
            {appearances.map((a) => (
              <VideoRow
                key={a.id}
                app={a}
                appState={voteA[a.id] ?? { likes: a.likes ?? 0, dislikes: a.dislikes ?? 0, myVote: null }}
                chState={voteC[a.channel_id] ?? { likes: a.channels?.likes ?? 0, dislikes: a.channels?.dislikes ?? 0, myVote: null }}
                onChangeApp={(next) => setVoteA((prev) => ({ ...prev, [a.id]: next }))}
                onChangeCh={(next) => setVoteC((prev) => ({ ...prev, [a.channel_id]: next }))}
              />
            ))}
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

function VideoRow({
  app,
  appState,
  chState,
  onChangeApp,
  onChangeCh,
}: {
  app: Appearance;
  appState: VoteState;
  chState: VoteState;
  onChangeApp: (next: VoteState) => void;
  onChangeCh: (next: VoteState) => void;
}) {
  const ytId = app.youtube_video_id ?? extractYouTubeId(app.source_url);
  const url = app.source_url ?? (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
  // 자세히보기 페이지의 YouTube 임베드와 동일한 영상의 썸네일을 사용.
  const thumb = app.thumbnail_url ?? ytThumbUrl(ytId, "mqdefault");
  return (
    <li className="p-3">
      <div className="flex gap-3">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-14 w-20 rounded object-cover" />
            ) : (
              <div className="h-14 w-20 rounded bg-neutral-100" />
            )}
          </a>
        ) : (
          thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
          ) : (
            <div className="h-14 w-20 shrink-0 rounded bg-neutral-100" />
          )
        )}
        <div className="flex-1 min-w-0">
          {/* 채널명 + 채널 투표 */}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-neutral-500">{app.channels?.name ?? "—"}</span>
            <VoteButton
              target_type="channel"
              target_id={app.channel_id}
              initialLikes={chState.likes}
              initialDislikes={chState.dislikes}
              initialMyVote={chState.myVote}
              onChange={onChangeCh}
            />
          </div>
          <div className="mt-0.5 line-clamp-2 text-sm font-bold text-neutral-900">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="hover:text-brand">{app.episode_title ?? "에피소드"}</a>
            ) : (app.episode_title ?? "에피소드")}
          </div>
          {/* 영상 투표 */}
          <div className="mt-1">
            <VoteButton
              target_type="appearance"
              target_id={app.id}
              initialLikes={appState.likes}
              initialDislikes={appState.dislikes}
              initialMyVote={appState.myVote}
              onChange={onChangeApp}
            />
          </div>
        </div>
      </div>
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
