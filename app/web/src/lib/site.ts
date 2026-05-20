/** 공유 카드 등에 박을 절대 URL 의 base 를 결정.
 *
 *  우선순위:
 *    1) NEXT_PUBLIC_SITE_URL — 운영 도메인 (예: https://popular-restaurant-by-broadcast.vercel.app)
 *    2) window.location.origin — 클라이언트가 실제로 떠 있는 URL (로컬 dev 시엔 http://localhost:3000)
 *
 *  → 로컬 dev 에서 공유를 눌러도 (1) 이 채워져 있으면 카드의 링크가 운영 도메인이 됨.
 *  → 빈 값이면 (2) fallback (그 외 사이트 origin).
 */
export function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (fromEnv) return fromEnv.replace(/\/+$/, ""); // trailing slash 제거
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** 현재 브라우저의 pathname + search 를 운영 base 와 결합해 공유용 절대 URL 반환.
 *  로컬에서 호출해도 NEXT_PUBLIC_SITE_URL 이 박혀 있으면 운영 도메인 기준이 됨.
 */
export function siteShareUrl(): string {
  if (typeof window === "undefined") return siteOrigin();
  return siteOrigin() + window.location.pathname + window.location.search;
}

/** 절대 경로 → 운영 base 와 결합. 예: absoluteUrl('/restaurants/171') */
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return siteOrigin() + p;
}
