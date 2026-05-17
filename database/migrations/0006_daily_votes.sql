-- 0006_daily_votes.sql
-- 투표를 '평생 1회'에서 '하루 1회(KST)'로 변경.
--
-- 변경점:
--   • 기존 유니크 제약 (user_id, target_type, target_id) 제거
--   • generated column vote_date(date) 추가 — KST 날짜
--   • 새 유니크 인덱스 (user_id, target_type, target_id, vote_date)
--
-- 어제까지 분 투표는 그대로 유지되며 집계 뷰에 누적 반영됨.
--
-- ─────────────────────────────────────────────────────────────────────
-- IMMUTABLE 함정 노트
-- ─────────────────────────────────────────────────────────────────────
-- Postgres 는 `timestamptz AT TIME ZONE 'string'` 을 항상 STABLE 로 분류함
-- ('UTC' 라 해도) → generated column 식에 직접 쓰면
-- `ERROR: 42P17 generation expression is not immutable` 로 거부됨.
--
-- 한국 시간대는 DST 가 없고 UTC+9 고정이라 결과는 사실상 결정적.
-- 이를 근거로 plpgsql 함수를 IMMUTABLE 로 선언해 wrap.
-- plpgsql 은 inlining 되지 않아 선언된 volatility 가 유지됨 → generated 식이 통과.
-- ─────────────────────────────────────────────────────────────────────

alter table public.votes
  drop constraint if exists votes_user_id_target_type_target_id_key;

create or replace function public.kst_date(ts timestamptz)
returns date
language plpgsql immutable parallel safe
as $$
begin
  return (ts at time zone 'UTC' + interval '9 hours')::date;
end
$$;

alter table public.votes
  add column if not exists vote_date date
  generated always as (public.kst_date(created_at)) stored;

create unique index if not exists votes_uniq_per_day
  on public.votes (user_id, target_type, target_id, vote_date);
