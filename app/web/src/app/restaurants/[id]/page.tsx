"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { api, type Appearance, type ExternalInfo, type Restaurant } from "@/lib/api";
import { shareKakaoTalk } from "@/lib/kakao-share";

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [apps, setApps] = useState<Appearance[]>([]);
  const [ext, setExt] = useState<ExternalInfo | null>(null);

  useEffect(() => {
    if (!id) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    // 세 호출 모두 개별 catch 로 unhandled rejection 방지 (FastAPI 미가동 등)
    fetch(`${base}/restaurants/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => setRestaurant(r))
      .catch(() => setRestaurant(null));
    api.topAppearances(id)
      .then((a) => setApps(a))
      .catch(() => setApps([]));
    api.externalInfo(id)
      .then((e) => setExt(e))
      .catch(() => setExt(null));
  }, [id]);

  if (!restaurant) return <div className="text-sm font-bold text-neutral-500">불러오는 중…</div>;

  // 가장 좋아요 많은 영상 = 첫번째
  const featured = apps[0] ?? null;
  const ytId = featured?.youtube_video_id ?? extractYouTubeId(featured?.source_url ?? "");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">{restaurant.current_name}</h1>
        <p className="mt-1 text-sm font-bold text-neutral-500">{restaurant.current_address}</p>
        {restaurant.cuisine && <p className="text-xs text-neutral-400">{restaurant.cuisine}</p>}
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
        {restaurant.naver_map_url && (
          <ExtLink href={restaurant.naver_map_url} className="bg-[#03C75A] text-white">📍 네이버 지도</ExtLink>
        )}
        {restaurant.kakao_map_url && (
          <ExtLink href={restaurant.kakao_map_url} className="bg-[#FEE500] text-black">
            📍 다음 지도{restaurant.kakao_rating ? ` ⭐ ${restaurant.kakao_rating.toFixed(1)}` : ""}
          </ExtLink>
        )}
      </div>

      <ShareBar restaurant={restaurant} featured={featured} ytId={ytId} />

      {/* 식당 정보 (네이버 플레이스) */}
      <PlaceInfo restaurant={restaurant} ext={ext} />

      {/* 영상 목록 (좋아요순) */}
      <section>
        <h2 className="font-soft mb-2 text-xl font-bold text-brand">소개된 영상</h2>
        <ul className="space-y-2">
          {apps.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="text-xs font-bold text-neutral-500">{a.channels?.name}</div>
              <div className="text-sm font-bold text-neutral-900">{a.episode_title}</div>
              <div className="mt-1 text-xs text-neutral-400">
                👍 {a.likes ?? 0} · 👎 {a.dislikes ?? 0} · {a.aired_at ?? ""}
              </div>
              {a.source_url && (
                <a href={a.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-brand">
                  영상 보기 →
                </a>
              )}
            </li>
          ))}
          {apps.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
              영상이 없습니다.
            </li>
          )}
        </ul>
      </section>
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

// ─────────────────────────────────────────────────────────────────────
// 식당 정보 패널 — 네이버 플레이스 summary 기반.
//   - 카테고리·영업시간·도로명/지번·리뷰수
//   - 사진 그리드 (최대 6장)
//   - 네이버 메뉴/리뷰/홈 외부 링크
// summary 호출 실패(ext.naver===null)시에도 우리 DB 기본 정보(주소·전화·메모)는 렌더.
// ─────────────────────────────────────────────────────────────────────
function PlaceInfo({ restaurant, ext }: { restaurant: Restaurant; ext: ExternalInfo | null }) {
  const naver = ext?.naver ?? null;
  const placeId = ext?.place_id ?? null;
  const images = (naver?.images?.images ?? []).slice(0, 6);

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-soft text-xl font-bold text-brand">식당 정보</h2>

      {/* 메타 칩 한 줄 — 카테고리 / 영업시간 */}
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        {naver?.category?.category && (
          <span className="rounded-full bg-brand-surface px-3 py-1 text-brand">
            #{naver.category.category}
          </span>
        )}
        {restaurant.cuisine && (
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
            {restaurant.cuisine}
          </span>
        )}
        {naver?.businessHours?.description && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            🕒 {naver.businessHours.description}
          </span>
        )}
        {naver?.visitorReviews?.displayText && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            ⭐ {naver.visitorReviews.displayText}
          </span>
        )}
        {typeof naver?.blogReviews?.total === "number" && naver.blogReviews.total > 0 && (
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
            ✍️ 블로그 리뷰 {naver.blogReviews.total.toLocaleString()}
          </span>
        )}
      </div>

      {/* 위치 */}
      <div>
        <h3 className="mb-1 text-sm font-bold text-neutral-800">위치</h3>
        <ul className="space-y-1 text-sm text-neutral-700">
          {(naver?.address?.roadAddress || restaurant.current_address) && (
            <li>
              <span className="mr-2 inline-block w-12 text-xs font-bold text-neutral-500">도로명</span>
              {naver?.address?.roadAddress ?? restaurant.current_address}
            </li>
          )}
          {naver?.address?.address && (
            <li>
              <span className="mr-2 inline-block w-12 text-xs font-bold text-neutral-500">지번</span>
              {naver.address.address}
            </li>
          )}
        </ul>
      </div>

      {/* 사진 그리드 */}
      {images.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-neutral-800">사진</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.origin}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-lg object-cover ring-1 ring-neutral-200"
              />
            ))}
          </div>
        </div>
      )}

      {/* 메모 (있으면) */}
      {restaurant.notes && (
        <div>
          <h3 className="mb-1 text-sm font-bold text-neutral-800">메모</h3>
          <p className="whitespace-pre-line text-sm text-neutral-700">{restaurant.notes}</p>
        </div>
      )}

      {/* 외부 링크 — 메뉴/리뷰는 네이버 공식 페이지로 */}
      {placeId ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={`https://pcmap.place.naver.com/restaurant/${placeId}/menu/list`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-[#03C75A] px-3 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            🍴 메뉴 보기 (네이버)
          </a>
          <a
            href={`https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[#03C75A] px-3 py-2 text-sm font-bold text-[#03C75A] hover:bg-emerald-50"
          >
            ⭐ 방문자 리뷰
          </a>
          <a
            href={`https://pcmap.place.naver.com/restaurant/${placeId}/home`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            네이버 플레이스 전체 →
          </a>
        </div>
      ) : (
        <p className="text-xs text-neutral-400">
          (네이버 플레이스 ID 가 없어 메뉴/리뷰 외부 링크는 표시되지 않습니다)
        </p>
      )}
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

  const url = typeof window !== "undefined" ? window.location.href : "";

  function copyLink() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareKakao() {
    // 카카오 JavaScript SDK 직접 호출 — Web Share API 의 브라우저 확장 가로채기 회피.
    const imageUrl = ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : `${window.location.origin}/white_eyes_blue.png`;
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
