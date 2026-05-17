-- 0007_request_restaurant_edit.sql
-- 맛집/영상 수정·삭제 요청 흐름 — admin 이 본인 charge_channel 의 영상에 대해 요청, superadmin 이 승인.
--
-- 변경점:
--   1. request_type enum 에 'restaurant_edit', 'restaurant_delete' 추가 (swap 방식)
--   2. requests 테이블에 컬럼 추가:
--        - restaurant_id BIGINT FK → restaurants(id) ON DELETE SET NULL
--        - appearance_id BIGINT FK → appearances(id) ON DELETE SET NULL
--        - payload       JSONB     (수정 요청 시 변경 후 값 스냅샷)
--
-- payload 스키마 (restaurant_edit):
--   {
--     "restaurant": { ...restaurants 의 변경 필드들 },
--     "appearance": { ...appearances 의 변경 필드들 }
--   }
-- payload 스키마 (restaurant_delete):
--   {} 또는 { "reason": "..." }   ← 삭제 사유 (옵션)

-- 1. enum 갱신 — swap 방식 (ALTER TYPE ADD VALUE 의 트랜잭션 제한 회피)
alter table public.requests alter column type type text;
drop type public.request_type;
create type public.request_type as enum (
  'channel_add',
  'admin_request',
  'bug',
  'etc',
  'notice',
  'restaurant_edit',
  'restaurant_delete'
);
alter table public.requests alter column type type public.request_type using type::public.request_type;

-- 2. 컬럼 추가
alter table public.requests
  add column if not exists restaurant_id bigint references public.restaurants(id) on delete set null,
  add column if not exists appearance_id bigint references public.appearances(id) on delete set null,
  add column if not exists payload       jsonb;

create index if not exists idx_requests_restaurant on public.requests (restaurant_id);
create index if not exists idx_requests_appearance on public.requests (appearance_id);
