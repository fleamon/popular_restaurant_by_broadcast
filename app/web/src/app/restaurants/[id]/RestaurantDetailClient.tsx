"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import BookmarkButton from "@/components/BookmarkButton";
import Map from "@/components/Map";
import VoteButton from "@/components/VoteButton";
import VoteLabel from "@/components/VoteLabel";
import Link from "next/link";

import { api, type Appearance, type RelatedRestaurant, type Restaurant, type VoteState } from "@/lib/api";
import { shareKakaoTalk } from "@/lib/kakao-share";
import { absoluteUrl, siteShareUrl } from "@/lib/site";

type VoteMap = Record<number, VoteState>;

// 서버(page.tsx)에서 미리 가져온 초기 데이터. 있으면 SSR HTML 에 본문이 채워지고
// 사용자도 로딩 깜빡임 없이 즉시 본문을 본다. 없으면(직접 마운트 등) 클라에서 fetch.
type Props = {
  initialRestaurant?: Restaurant | null;
  initialApps?: Appearance[];
  initialRelated?: RelatedRestaurant[];
};

export default function RestaurantDetailClient({
  initialRestaurant = null,
  initialApps = [],
  initialRelated = [],
}: Props = {}) {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(initialRestaurant);
  const [apps, setApps] = useState<Appearance[]>(initialApps);
  const [related, setRelated] = useState<RelatedRestaurant[]>(initialRelated);
  const [isBookmarked, setIsBookmarked] = useState<boolean | undefined>(undefined);
  // 채널/영상 북마크 — undefined: 비로그인
  const [bmC, setBmC] = useState<Record<number, boolean> | undefined>(undefined);
  const [bmA, setBmA] = useState<Record<number, boolean> | undefined>(undefined);

  // 투표 상태 — 식당/채널/영상 별로 (target_id → state). 같은 채널이 여러 영상에 등장해도 한 번 클릭 시 모두 동기화.
  // 서버에서 받은 초기 데이터로 즉시 seed → SSR HTML 의 좋아요 수가 정확하고 깜빡임 없음.
  const [voteR, setVoteR] = useState<VoteMap>(() =>
    initialRestaurant
      ? { [initialRestaurant.id]: { likes: initialRestaurant.likes ?? 0, dislikes: initialRestaurant.dislikes ?? 0, myVote: null } }
      : {},
  );
  const [voteC, setVoteC] = useState<VoteMap>(() => seedChannelVotes(initialApps));
  const [voteA, setVoteA] = useState<VoteMap>(() => seedAppearanceVotes(initialApps));

  useEffect(() => {
    if (!id) return;
    // 초기 데이터가 서버에서 안 왔을 때만(예: 직접 마운트) 클라에서 본문 데이터 fetch.
    // ISR(1h) 로 받은 초기 데이터가 있으면 중복 호출을 피한다.
    if (!initialRestaurant) {
      api.getRestaurant(id)
        .then((r) => {
          setRestaurant(r);
          if (r) {
            setVoteR((prev) => ({
              ...prev,
              [r.id]: { likes: r.likes ?? 0, dislikes: r.dislikes ?? 0, myVote: prev[r.id]?.myVote ?? null },
            }));
          }
        })
        .catch(() => setRestaurant(null));
      api.relatedRestaurants(id).then(setRelated).catch(() => setRelated([]));
      api.topAppearances(id)
        .then((apps) => {
          setApps(apps);
          setVoteA((prev) => ({ ...prev, ...seedAppearanceVotes(apps, prev) }));
          setVoteC((prev) => ({ ...prev, ...seedChannelVotes(apps, prev) }));
        })
        .catch(() => setApps([]));
    }

    // 내 투표 — 페이지 마운트 시 한 번 fetch. 비로그인은 401 → 무시.
    const mergeMy = (setter: typeof setVoteR) => (mv: Record<string, 1 | -1>) => {
      setter((prev) => {
        const next = { ...prev };
        for (const [idStr, v] of Object.entries(mv)) {
          const k = Number(idStr);
          next[k] = { likes: prev[k]?.likes ?? 0, dislikes: prev[k]?.dislikes ?? 0, myVote: v };
        }
        return next;
      });
    };
    api.myVotes("restaurant").then(mergeMy(setVoteR)).catch(() => {});
    api.myVotes("channel").then(mergeMy(setVoteC)).catch(() => {});
    api.myVotes("appearance").then(mergeMy(setVoteA)).catch(() => {});
    api.bookmarkIds().then((ids) => {
      setIsBookmarked(!!ids[`restaurant:${id}`]);
      const c: Record<number, boolean> = {};
      const a: Record<number, boolean> = {};
      for (const key of Object.keys(ids)) {
        if (key.startsWith("channel:")) c[Number(key.slice("channel:".length))] = true;
        else if (key.startsWith("appearance:")) a[Number(key.slice("appearance:".length))] = true;
      }
      setBmC(c);
      setBmA(a);
    }).catch(() => {});
  }, [id]);

  if (!restaurant) return <div className="text-sm font-bold text-neutral-500">불러오는 중…</div>;

  // 가장 좋아요 많은 영상 = 첫번째
  const featured = apps[0] ?? null;
  const ytId = featured?.youtube_video_id ?? extractYouTubeId(featured?.source_url ?? "");

  const rState = voteR[restaurant.id] ?? { likes: restaurant.likes ?? 0, dislikes: restaurant.dislikes ?? 0, myVote: null };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start gap-3">
          <h1 className="font-soft flex-1 text-3xl font-bold tracking-tight text-brand">{restaurant.current_name}</h1>
          {isBookmarked !== undefined && (
            <BookmarkButton
              target_type="restaurant"
              target_id={restaurant.id}
              initialBookmarked={isBookmarked}
              onChange={(_, bm) => setIsBookmarked(bm)}
            />
          )}
        </div>
        <p className="mt-1 text-sm font-bold text-neutral-500">{restaurant.current_address}</p>
        {restaurant.cuisine && <p className="text-xs text-neutral-400">{restaurant.cuisine}</p>}
        {/* 식당 좋아요는 하단 '식당 정보' 카드에서만 노출 — 페이지 상단은 제목만 */}
        <RestaurantSummary restaurant={restaurant} apps={apps} />
      </div>

      {/* YouTube 임베드 */}
      {ytId ? (
        <div className="aspect-video overflow-hidden rounded-xl border border-neutral-200 bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="grid h-48 place-items-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-400">
          등록된 영상이 없습니다
        </div>
      )}

      {/* 외부 링크 버튼 */}
      <div className="flex flex-wrap gap-2">
        {featured?.source_url && (
          <ExtLink href={featured.source_url} className="bg-red-600 text-white">▶ YouTube 에서 보기</ExtLink>
        )}
        {/* 네이버/다음 지도 — URL 이 DB 에 없으면 가게 이름으로 검색 fallback (핀 모달과 동일 동작). */}
        <ExtLink
          href={restaurant.naver_map_url ?? `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.current_name)}`}
          className="bg-[#03C75A] text-white"
        >
          📍 네이버 지도
        </ExtLink>
        <ExtLink
          href={restaurant.kakao_map_url ?? `https://map.kakao.com/?q=${encodeURIComponent(restaurant.current_name)}`}
          className="bg-[#FEE500] text-black"
        >
          📍 다음 지도{restaurant.kakao_rating ? ` ⭐ ${restaurant.kakao_rating.toFixed(1)}` : ""}
        </ExtLink>
      </div>

      <ShareBar restaurant={restaurant} featured={featured} ytId={ytId} />

      {/* 식당 정보 — 우리 DB 정보 + 지도 링크아웃 */}
      <PlaceInfo
        restaurant={restaurant}
        rState={rState}
        onChangeR={(next) => setVoteR((prev) => ({ ...prev, [restaurant.id]: next }))}
        isBookmarked={isBookmarked}
        onBookmarkChange={(_, bm) => setIsBookmarked(bm)}
      />

      {/* 지도 — 좌표가 있을 때만. 단일 핀(기존 Map 재사용). */}
      {restaurant.lat != null && restaurant.lng != null && (
        <section>
          <h2 className="font-soft mb-2 text-xl font-bold text-brand">지도</h2>
          <div className="h-64 overflow-hidden rounded-xl border border-neutral-200">
            <Map
              restaurants={[restaurant]}
              center={{ lat: restaurant.lat, lng: restaurant.lng }}
              level={3}
            />
          </div>
        </section>
      )}

      {/* 영상 목록 (좋아요순) */}
      <section>
        <h2 className="font-soft mb-2 text-xl font-bold text-brand">소개된 영상</h2>
        <ul className="space-y-2">
          {apps.map((a) => {
            const aState = voteA[a.id] ?? { likes: a.likes ?? 0, dislikes: a.dislikes ?? 0, myVote: null };
            const cState = voteC[a.channel_id] ?? { likes: a.channels?.likes ?? 0, dislikes: a.channels?.dislikes ?? 0, myVote: null };
            return (
              <li key={a.id} className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                {/* 채널 라인 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <VoteLabel kind="channel" />
                    <span className="truncate text-sm font-bold text-neutral-700">{a.channels?.name ?? "—"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <VoteButton
                      target_type="channel"
                      target_id={a.channel_id}
                      initialLikes={cState.likes}
                      initialDislikes={cState.dislikes}
                      initialMyVote={cState.myVote}
                      onChange={(next) => setVoteC((prev) => ({ ...prev, [a.channel_id]: next }))}
                      size="sm"
                    />
                    {bmC !== undefined && (
                      <BookmarkButton
                        target_type="channel"
                        target_id={a.channel_id}
                        initialBookmarked={bmC[a.channel_id] ?? false}
                        onChange={(bid, bm) => setBmC((prev) => { if (!prev) return prev; const n = { ...prev }; if (bm) n[bid] = true; else delete n[bid]; return n; })}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
                {/* 영상 라인 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <VoteLabel kind="appearance" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-neutral-900 line-clamp-2">{a.episode_title}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">{a.aired_at ?? ""}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <VoteButton
                      target_type="appearance"
                      target_id={a.id}
                      initialLikes={aState.likes}
                      initialDislikes={aState.dislikes}
                      initialMyVote={aState.myVote}
                      onChange={(next) => setVoteA((prev) => ({ ...prev, [a.id]: next }))}
                      size="sm"
                    />
                    {bmA !== undefined && (
                      <BookmarkButton
                        target_type="appearance"
                        target_id={a.id}
                        initialBookmarked={bmA[a.id] ?? false}
                        onChange={(bid, bm) => setBmA((prev) => { if (!prev) return prev; const n = { ...prev }; if (bm) n[bid] = true; else delete n[bid]; return n; })}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
                {a.source_url && (
                  <div className="text-right">
                    <a href={a.source_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand">
                      영상 보기 →
                    </a>
                  </div>
                )}
              </li>
            );
          })}
          {apps.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
              영상이 없습니다.
            </li>
          )}
        </ul>
      </section>

      {/* 근처·연관 맛집 — 같은 지역/카테고리 다른 맛집 (내부 링크) */}
      {related.length > 0 && (
        <section>
          <h2 className="font-soft mb-2 text-xl font-bold text-brand">
            {restaurant.sigungu ? `${restaurant.sigungu} 근처 맛집` : "연관 맛집"}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/restaurants/${r.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-brand hover:bg-brand-surface"
                >
                  <div className="font-soft truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                    {r.current_name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-neutral-500">{r.current_address}</div>
                  {r.cuisine && <div className="mt-0.5 text-[11px] text-neutral-400">{r.cuisine}</div>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ExtLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`rounded-md px-3 py-2 text-sm font-bold hover:opacity-90 ${className ?? ""}`}
    >
      {children}
    </a>
  );
}

// 데이터로 구성하는 한 줄 소개 — 각 맛집 페이지에 원문 텍스트를 더해 콘텐츠 가치를 높인다(SEO/AdSense).
function RestaurantSummary({ restaurant, apps }: { restaurant: Restaurant; apps: Appearance[] }) {
  const channels = Array.from(
    new Set(apps.map((a) => a.channels?.name).filter((n): n is string => !!n)),
  );
  const n = apps.length;
  if (n === 0 && channels.length === 0) return null;

  const channelText =
    channels.length === 0
      ? "방송"
      : channels.length <= 2
        ? channels.join(", ")
        : `${channels.slice(0, 2).join(", ")} 등 ${channels.length}개 채널`;
  const cuisineText = restaurant.cuisine ? `${restaurant.cuisine} ` : "";

  return (
    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
      <strong className="text-neutral-800">{restaurant.current_name}</strong>
      {" "}은(는) {channelText}에 소개된 {cuisineText}맛집입니다.
      {restaurant.current_address ? ` ${restaurant.current_address}에 위치하며,` : ""}
      {n > 0 ? ` 아래에서 소개 영상 ${n}건과 지도 위치를 확인할 수 있습니다.` : " 아래에서 지도 위치를 확인할 수 있습니다."}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 식당 정보 패널 — 우리 DB 정보(이름·주소·cuisine·메모)만 표시.
//   네이버 플레이스 summary(카테고리·영업시간·리뷰·사진)는 비공식 스크래핑이라 제거.
//   메뉴/리뷰는 네이버 공식 페이지로 '링크아웃'만 제공(restaurant.naver_place_id 보유 시).
// ─────────────────────────────────────────────────────────────────────
function PlaceInfo({
  restaurant,
  rState,
  onChangeR,
  isBookmarked,
  onBookmarkChange,
}: {
  restaurant: Restaurant;
  rState: VoteState;
  onChangeR: (next: VoteState) => void;
  isBookmarked?: boolean;
  onBookmarkChange?: (id: number, bookmarked: boolean) => void;
}) {
  const placeId = restaurant.naver_place_id ?? null;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-soft text-xl font-bold text-brand">식당 정보</h2>
          {/* 페이지 상단과 별도로 한 번 더 표시 — 카드 안에서도 어떤 식당인지 명확하게 */}
          <p className="mt-1 text-base font-bold text-neutral-900">{restaurant.current_name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{restaurant.current_address}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VoteLabel kind="restaurant" />
          <VoteButton
            target_type="restaurant"
            target_id={restaurant.id}
            initialLikes={rState.likes}
            initialDislikes={rState.dislikes}
            initialMyVote={rState.myVote}
            onChange={onChangeR}
          />
          {isBookmarked !== undefined && (
            <BookmarkButton
              target_type="restaurant"
              target_id={restaurant.id}
              initialBookmarked={isBookmarked}
              onChange={onBookmarkChange}
            />
          )}
        </div>
      </div>

      {/* 메타 칩 — 음식 종류 (우리 DB) */}
      {restaurant.cuisine && (
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
            {restaurant.cuisine}
          </span>
        </div>
      )}

      {/* 위치 */}
      <div>
        <h3 className="mb-1 text-sm font-bold text-neutral-800">위치</h3>
        <ul className="space-y-1 text-sm text-neutral-700">
          {restaurant.current_address && (
            <li>
              <span className="mr-2 inline-block w-12 text-xs font-bold text-neutral-500">주소</span>
              {restaurant.current_address}
            </li>
          )}
          {restaurant.phone && (
            <li>
              <span className="mr-2 inline-block w-12 text-xs font-bold text-neutral-500">전화</span>
              {restaurant.phone}
            </li>
          )}
        </ul>
      </div>

      {/* 메모 (있으면) */}
      {restaurant.notes && (
        <div>
          <h3 className="mb-1 text-sm font-bold text-neutral-800">메모</h3>
          <p className="whitespace-pre-line text-sm text-neutral-700">{restaurant.notes}</p>
        </div>
      )}

      {/* 외부 링크아웃 — 콘텐츠를 가져오지 않고 네이버/카카오 공식 페이지로 이동만. */}
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={
            placeId
              ? `https://m.place.naver.com/restaurant/${placeId}/home`
              : restaurant.naver_map_url ?? `https://map.naver.com/p/search/${encodeURIComponent(restaurant.current_name)}`
          }
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#03C75A] px-3 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          📍 네이버 지도에서 보기
        </a>
        <a
          href={restaurant.kakao_map_url ?? `https://map.kakao.com/?q=${encodeURIComponent(restaurant.current_name)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#FEE500] px-3 py-2 text-sm font-bold text-black hover:opacity-90"
        >
          📍 카카오맵에서 보기
        </a>
      </div>
    </section>
  );
}

function ShareBar({
  restaurant,
  featured,
  ytId,
}: {
  restaurant: Restaurant;
  featured: Appearance | null;
  ytId: string | null;
}) {
  const [copied, setCopied] = useState(false);

  // 운영 도메인(NEXT_PUBLIC_SITE_URL) 기준 절대 URL — 로컬 dev 에서도 공유 카드는 운영 도메인.
  const url = siteShareUrl();

  function copyLink() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareKakao() {
    // 카카오 JavaScript SDK 직접 호출 — Web Share API 의 브라우저 확장 가로채기 회피.
    const imageUrl = ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : absoluteUrl("/white_eyes_blue.png");
    const description = [
      restaurant.current_address,
      featured?.channels?.name,
      featured?.episode_title,
    ].filter(Boolean).join(" · ");
    const ok = await shareKakaoTalk({
      title: restaurant.current_name,
      description: description || "백안맛지도",
      imageUrl,
      url,
    });
    if (!ok) {
      copyLink();
      alert("카카오 공유를 사용할 수 없어 링크를 복사했습니다.\n(Kakao Developers '플랫폼 → Web' 도메인 등록 확인)");
    }
  }

  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "width=600,height=400");
  }

  function openNewWindow() {
    window.open(url, "_blank", "width=900,height=700");
  }

  function openNewTab() {
    window.open(url, "_blank");
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-sm font-bold text-neutral-700 mb-2">공유 / 보기</div>
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <button onClick={shareKakao} className="rounded bg-[#FEE500] px-3 py-1.5 text-black">카카오톡 공유</button>
        <button onClick={shareFacebook} className="rounded bg-[#1877F2] px-3 py-1.5 text-white">페이스북 공유</button>
        <button onClick={copyLink} className="rounded border px-3 py-1.5">{copied ? "✓ 복사됨" : "링크 복사"}</button>
        <button onClick={openNewWindow} className="rounded border px-3 py-1.5">새 창으로</button>
        <button onClick={openNewTab} className="rounded border px-3 py-1.5">새 탭으로</button>
      </div>
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? m[1] : null;
}

// 영상 목록에서 채널/영상 투표 초기 상태 seed. prev 가 있으면 내 투표(myVote)는 보존.
function seedAppearanceVotes(apps: Appearance[], prev: VoteMap = {}): VoteMap {
  const next: VoteMap = {};
  for (const a of apps) {
    next[a.id] = { likes: a.likes ?? 0, dislikes: a.dislikes ?? 0, myVote: prev[a.id]?.myVote ?? null };
  }
  return next;
}

function seedChannelVotes(apps: Appearance[], prev: VoteMap = {}): VoteMap {
  const next: VoteMap = {};
  for (const a of apps) {
    if (!a.channel_id) continue;
    next[a.channel_id] = {
      likes: a.channels?.likes ?? 0,
      dislikes: a.channels?.dislikes ?? 0,
      myVote: prev[a.channel_id]?.myVote ?? null,
    };
  }
  return next;
}
