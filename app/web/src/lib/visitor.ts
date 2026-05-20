/** visitor_id — 브라우저 localStorage 의 익명 UUID. 한 device 의 unique 식별자.
 *  로그인 무관, 쿠키 동의 무관 (식별자에 PII 없음). 광고/추적 목적 아님 — 방문자 카운트만.
 */
const KEY = "visitor_id";

function uuid(): string {
  // crypto.randomUUID 가 모던 브라우저 기본. 없으면 timestamp + random fallback.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let v = window.localStorage.getItem(KEY);
  if (!v) {
    v = uuid();
    try { window.localStorage.setItem(KEY, v); } catch { /* private mode 등 ignore */ }
  }
  return v;
}
