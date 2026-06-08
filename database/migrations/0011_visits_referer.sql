-- 0011_visits_referer.sql
-- 방문 유입 출처(referer) 집계용 컬럼 추가.
--
-- 동작:
--   • 프런트가 랜딩 시 document.referrer 를 track 요청에 함께 전송
--   • 백엔드가 호스트 기준으로 정규화한 라벨(예: 네이버 / Google / 직접 / 사이트 내)을 저장
--   • (visitor_id, visit_date) UNIQUE + ignore_duplicates 라 '그 날 첫 방문'의 유입원만 보존됨
--   • 기존 행(referer NULL)은 집계 시 '(미상)' 으로 표시

alter table public.visits
  add column if not exists referer text;

create index if not exists idx_visits_referer on public.visits (visit_date, referer);
