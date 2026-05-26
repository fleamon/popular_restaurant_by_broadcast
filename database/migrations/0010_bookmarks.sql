-- 0010_bookmarks.sql — 북마크 테이블 추가
create table if not exists public.bookmarks (
  id          bigserial primary key,
  user_id     bigint not null references public.users(sequence) on delete cascade,
  target_type text not null check (target_type in ('restaurant','channel','appearance')),
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);
create index if not exists idx_bookmarks_user on public.bookmarks (user_id, target_type);
