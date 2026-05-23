"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CustomOverlayMap,
  Map as KakaoMap,
  useKakaoLoader,
} from "react-kakao-maps-sdk";

import VoteButton from "@/components/VoteButton";
import VoteLabel from "@/components/VoteLabel";
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

/** Kakao 지도 인스턴스 → bounds 4개 좌표를 부모에 전달. onCreate / onIdle 양쪽에서 재사용. */
type KakaoMapInstance = {
  getBounds: () => {
    getSouthWest: () => { getLat: () => number; getLng: () => number };
    getNorthEast: () => { getLat: () => number; getLng: () => number };
  };
};
function notify(
  map: KakaoMapInstance,
  cb: (b: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number }) => void,
) {
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  cb({ sw_lat: sw.getLat(), sw_lng: sw.getLng(), ne_lat: ne.getLat(), ne_lng: ne.getLng() });
}

type Props = {
  restaurants: Restaurant[];
  center?: { lat: number; lng: number };
  level?: number;
  /** 지도 viewport 가 안정화되면 부모에게 bounds 통지 — 페이지가 그 영역만 fetch 하도록 */
  onBoundsChanged?: (b: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number }) => void;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울특별시청
// 카카오 지도 level — 작을수록 확대. 8(과거) → 5 (3단계 확대).
const DEFAULT_LEVEL = 4;

// 함수 이름을 'Map' 으로 두면 본문 내 `new Map()` 이 글로벌 Map 대신 자기 자신을 가리킨다.
// 이 충돌을 피하기 위해 함수 이름은 RestaurantMap, default export 는 그대로 유지.
export default function RestaurantMap({ restaurants, center = DEFAULT_CENTER, level = DEFAULT_LEVEL, onBoundsChanged }: Props) {
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
        // 지도 인스턴스 생성 직후 즉시 첫 bounds 통지 — onIdle 까지 기다리지 않고 viewport 핀 바로 보임.
        // 가끔 onCreate 시점에 getBounds 가 미정이라 다음 tick 으로 한 번 미룸.
        onCreate={(map) => {
          if (!onBoundsChanged) return;
          setTimeout(() => notify(map, onBoundsChanged), 0);
        }}
        // 사용자 조작 완료(이동/줌 idle) → viewport bounds 부모에게 통지 → 그 영역만 fetch.
        onIdle={(map) => { if (onBoundsChanged) notify(map, onBoundsChanged); }}
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

  // 모달 외부 클릭/터치 시 닫기 — 지도 안뿐 아니라 헤더·페이지 어디든 OK.
  // mount 직후의 핀 클릭 이벤트가 document 까지 올라오는 race 를 setTimeout(0) 으로 회피.
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      const node = modalRef.current;
      if (!node) return;
      const target = e.target as Node | null;
      if (target && node.contains(target)) return;
      onClose();
    }
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
      document.addEventListener("touchstart", onOutside, { passive: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [onClose]);

  return (
    // 모바일: 좌우 8px 마진 + 화면 폭 가득(좌상단 고정), 세로 80vh 한도 + 내부 스크롤.
    // 데스크탑: 기존 우상단 380px 카드.
    <div
      ref={modalRef}
      className={[
        "absolute z-10 overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200",
        // 모바일 — left/top 2 + 폭/높이 화면 기준
        "left-2 right-2 top-2 max-h-[80vh]",
        // 데스크탑 — 기존 우상단 380px 고정
        "sm:left-auto sm:right-4 sm:top-4 sm:w-[380px] sm:max-h-[calc(100vh-2rem)]",
      ].join(" ")}
    >
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 sm:right-3 sm:top-3"
      >
        ×
      </button>
      <div className="p-3 pr-9 sm:p-4 sm:pr-10">
        <div className="pr-2 text-sm font-bold text-brand sm:text-base">{restaurant.current_name}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500 sm:mt-1 sm:text-xs">{restaurant.current_address}</div>
        {/* 식당 투표 — 라벨로 어떤 대상인지 명시 */}
        <div className="mt-2 flex items-center gap-2">
          <VoteLabel kind="restaurant" />
          <VoteButton
            target_type="restaurant"
            target_id={restaurant.id}
            initialLikes={rState.likes}
            initialDislikes={rState.dislikes}
            initialMyVote={rState.myVote}
            onChange={(next) => setVoteR((prev) => ({ ...prev, [restaurant.id]: next }))}
            size="sm"
          />
        </div>
        <div className="mt-2 flex gap-2 sm:mt-3">
          <a
            href={restaurant.naver_map_url ?? `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.current_name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-md bg-[#03C75A] px-2 py-1.5 text-center text-[11px] font-bold text-white hover:opacity-90 sm:px-3 sm:text-xs"
          >
            네이버지도
          </a>
          <a
            href={restaurant.kakao_map_url ?? `https://map.kakao.com/?q=${encodeURIComponent(restaurant.current_name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-md bg-[#FEE500] px-2 py-1.5 text-center text-[11px] font-bold text-black hover:opacity-90 sm:px-3 sm:text-xs"
          >
            다음지도
            {restaurant.kakao_rating ? <span className="ml-1">⭐ {restaurant.kakao_rating.toFixed(1)}</span> : null}
          </a>
        </div>
      </div>

      <div className="border-t border-neutral-100">
        {loading ? (
          <p className="p-3 text-[11px] text-neutral-400 sm:p-4 sm:text-xs">대표 영상 불러오는 중…</p>
        ) : appearances.length === 0 ? (
          <p className="p-3 text-[11px] text-neutral-400 sm:p-4 sm:text-xs">아직 등록된 영상이 없습니다.</p>
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

      <div className="border-t border-neutral-100 p-2 text-center sm:p-3">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="inline-block w-full rounded-md bg-brand px-3 py-1.5 text-xs font-bold text-brand-fg hover:bg-brand-hover sm:py-2 sm:text-sm"
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
  // 모바일 컴팩트: 썸네일 h-12 w-16, 패딩 p-2 — 데스크탑은 기존
  return (
    <li className="p-2 sm:p-3">
      <div className="flex gap-2 sm:gap-3">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-12 w-16 rounded object-cover sm:h-14 sm:w-20" />
            ) : (
              <div className="h-12 w-16 rounded bg-neutral-100 sm:h-14 sm:w-20" />
            )}
          </a>
        ) : (
          thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-12 w-16 shrink-0 rounded object-cover sm:h-14 sm:w-20" />
          ) : (
            <div className="h-12 w-16 shrink-0 rounded bg-neutral-100 sm:h-14 sm:w-20" />
          )
        )}
        <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
          {/* 채널 라인 — 라벨 + 채널명 + 채널 투표 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <VoteLabel kind="channel" />
              <span className="truncate text-[11px] font-bold text-neutral-700 sm:text-xs">{app.channels?.name ?? "—"}</span>
            </div>
            <VoteButton
              target_type="channel"
              target_id={app.channel_id}
              initialLikes={chState.likes}
              initialDislikes={chState.dislikes}
              initialMyVote={chState.myVote}
              onChange={onChangeCh}
              size="sm"
            />
          </div>
          {/* 영상 라인 — 라벨+제목 한 줄, 투표는 별도 줄 우측 정렬 (모달 폭 안에서 잘림 방지) */}
          <div>
            <div className="flex min-w-0 items-start gap-1.5">
              <VoteLabel kind="appearance" className="mt-0.5" />
              <div className="line-clamp-2 text-xs font-bold text-neutral-900 sm:text-sm">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="hover:text-brand">{app.episode_title ?? "에피소드"}</a>
                ) : (app.episode_title ?? "에피소드")}
              </div>
            </div>
            <div className="mt-1 flex justify-end">
              <VoteButton
                target_type="appearance"
                target_id={app.id}
                initialLikes={appState.likes}
                initialDislikes={appState.dislikes}
                initialMyVote={appState.myVote}
                onChange={onChangeApp}
                size="sm"
              />
            </div>
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
