-- 0009_visits.sql
-- 방문자 통계 — 좌측 하단 위젯에 표시 (오늘 / 총 unique 방문자).
--
-- 동작:
--   • 브라우저가 localStorage 의 device_id(UUID) 를 보관 → 첫 방문 시 백엔드에 track 요청
--   • (visitor_id, visit_date) UNIQUE → 같은 device 가 하루에 여러 번 와도 1회만 카운트
--   • visit_date 는 KST(UTC+9) 기준 generated column (votes 의 vote_date 와 동일 패턴)

create table if not exists public.visits (
  id          bigserial primary key,
  visitor_id  text not null,
  created_at  timestamptz not null default now(),
  visit_date  date generated always as (public.kst_date(created_at)) stored
);

create unique index if not exists visits_uniq_per_day
  on public.visits (visitor_id, visit_date);

create index if not exists idx_visits_visit_date on public.visits (visit_date);

-- RLS — 누구나 insert 가능 (방문자 카운터는 익명 접근 OK).
alter table public.visits enable row level security;

drop policy if exists "visits insert anyone" on public.visits;
create policy "visits insert anyone" on public.visits for insert with check (true);

drop policy if exists "visits read aggregated" on public.visits;
create policy "visits read aggregated" on public.visits for select using (true);
