-- 공지사항(notice) 타입 추가 + 길이 제약 완화
-- Supabase SQL Editor 에 통째로 붙여넣기 — swap 방식으로 한 트랜잭션 내 처리.

-- 1. enum 에 'notice' 추가 (swap 방식 — ALTER TYPE ADD VALUE 의 트랜잭션 제한 회피)
ALTER TABLE public.requests ALTER COLUMN type TYPE TEXT;
DROP TYPE public.request_type;
CREATE TYPE public.request_type AS ENUM ('channel_add', 'admin_request', 'bug', 'etc', 'notice');
ALTER TABLE public.requests ALTER COLUMN type TYPE public.request_type USING type::public.request_type;

-- 2. 길이 제약 완화 — 공지사항은 길이 제한 없음. 다른 타입은 백엔드에서 검증.
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_title_check;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_content_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_title_check
  CHECK (char_length(title) >= 1);
-- content 는 NULL 허용, 길이 제약 없음 (notice 등 무제한)
