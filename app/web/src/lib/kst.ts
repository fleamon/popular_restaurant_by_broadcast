// KST(UTC+9) 날짜 유틸 — 클라 시계가 KST 가 아닐 수 있어 UTC 에 +9h offset 후 YYYY-MM-DD.
// 투표 기간 필터 등에서 공용. (백엔드 votes.vote_date / visits.visit_date 와 동일 기준.)

export function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function daysAgoKst(n: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 - n * 86400000);
  return kst.toISOString().slice(0, 10);
}
