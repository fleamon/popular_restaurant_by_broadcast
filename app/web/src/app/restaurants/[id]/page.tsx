"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { api, type Appearance, type Restaurant } from "@/lib/api";
import { shareKakaoTalk } from "@/lib/kakao-share";

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [apps, setApps] = useState<Appearance[]>([]);

  useEffect(() => {
    if (!id) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    // 두 호출 모두 개별 catch 로 unhandled rejection 방지 (FastAPI 미가동 등)
    fetch(`${base}/restaurants/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => setRestaurant(r))
      .catch(() => setRestaurant(null));
    api.topAppearances(id)
      .then((a) => setApps(a))
      .catch(() => setApps([]));
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
