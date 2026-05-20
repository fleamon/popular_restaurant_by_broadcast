/** 공유 카드 등에 박을 절대 URL 의 base 를 결정.
 *
 *  우선순위:
 *    1) NEXT_PUBLIC_SITE_URL — 운영 도메인 (예: https://popular-restaurant-by-broadcast.vercel.app)
 *    2) window.location.origin — 클라이언트가 실제로 떠 있는 URL (로컬 dev 시엔 http://localhost:3000)
 *
 *  → 로컬 dev 에서 공유를 눌러도 (1) 이 채워져 있으면 카드의 링크가 운영 도메인이 됨.
 *  → 빈 값이면 (2) fallback (그 외 사이트 origin).
 */
// localhost / 사설망 패턴 — 운영 공유 URL 로는 절대 박혀선 안 됨
const LOCAL_ORIGIN_RE = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?$/i;

function looksLocal(url: string): boolean {
  return LOCAL_ORIGIN_RE.test(url.replace(/\/+$/, ""));
}

export function siteOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  // env 가 비어있거나 localhost 면 무시 — Vercel 빌드 env 에 실수로 localhost 가 박혔어도 안전.
  if (fromEnv && !looksLocal(fromEnv)) return fromEnv;
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    // 브라우저가 실제로 운영에서 떠 있으면 그 origin 사용.
    // (로컬 dev 에선 localhost — 카카오 공유 카드도 localhost 가 박히지만, 그건 의도된 동작)
    return origin;
  }
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
