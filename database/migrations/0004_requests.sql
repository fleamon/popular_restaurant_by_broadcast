-- 요청 게시판 — 채널 추가/관리자 요청/버그/기타 + superadmin↔작성자 대화 댓글
-- Supabase SQL Editor 에 통째로 붙여넣기

DROP TABLE IF EXISTS public.request_comments CASCADE;
DROP TABLE IF EXISTS public.requests         CASCADE;
DROP TYPE  IF EXISTS public.request_status   CASCADE;
DROP TYPE  IF EXISTS public.request_type     CASCADE;

CREATE TYPE public.request_type   AS ENUM ('channel_add', 'admin_request', 'bug', 'etc');
CREATE TYPE public.request_status AS ENUM ('요청', '처리중', '완료', '반려');

CREATE TABLE public.requests (
  id            BIGSERIAL PRIMARY KEY,
  author_id     BIGINT NOT NULL REFERENCES public.users(sequence) ON DELETE CASCADE,
  type          public.request_type   NOT NULL,
  status        public.request_status NOT NULL DEFAULT '요청',
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  content       TEXT      CHECK (content IS NULL OR char_length(content) <= 200),
  channel_type  TEXT      CHECK (channel_type IS NULL OR channel_type IN ('tv','youtube','blog','other')),
  channel_url   TEXT      CHECK (channel_url IS NULL OR char_length(channel_url) <= 200),
  channel_id    BIGINT REFERENCES public.channels(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_requests_author ON public.requests (author_id);
CREATE INDEX idx_requests_status ON public.requests (status);
CREATE INDEX idx_requests_created ON public.requests (created_at DESC);

CREATE TABLE public.request_comments (
  id         BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES public.users(sequence) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_request_comments_req ON public.request_comments (request_id, created_at);

-- updated_at 자동 갱신 (있다면 기존 trg_set_updated_at 함수 재사용)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_set_updated_at') THEN
    EXECUTE 'CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.requests
             FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at()';
  END IF;
END$$;
