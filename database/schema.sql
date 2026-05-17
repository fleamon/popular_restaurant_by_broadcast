-- 백안맛지도 Supabase 스키마 v2 — 완전 재생성
-- 실행: Supabase Dashboard → SQL Editor 에 전체 붙여넣고 Run.
-- 멱등 — 기존 객체 모두 DROP 후 CREATE.

-- ─────────────────────────────────────────────────────────────────────
-- 0. 기존 객체 전부 정리 (CASCADE 로 의존객체까지)
-- ─────────────────────────────────────────────────────────────────────
drop view  if exists public.v_top2_appearances           cascade;
drop view  if exists public.v_trending_appearances       cascade;
drop view  if exists public.v_appearance_score          cascade;
drop view  if exists public.v_top_representative_appearance cascade;
drop view  if exists public.v_channel_score              cascade;
drop view  if exists public.v_restaurant_score           cascade;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.votes        cascade;
drop table if exists public.appearances  cascade;
drop table if exists public.restaurants  cascade;
drop table if exists public.channels     cascade;
drop table if exists public.users        cascade;
drop table if exists public.profiles     cascade;  -- 구버전 흔적 제거

drop function if exists public.handle_new_user()    cascade;
drop function if exists public.set_updated_at()     cascade;
drop function if exists public.current_user_id()    cascade;
drop function if exists public.is_admin_or_super()  cascade;
drop function if exists public.kst_date(timestamptz) cascade;

drop type if exists public.user_role cascade;

-- ─────────────────────────────────────────────────────────────────────
-- 1. 확장
-- ─────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
-- 2. 공통 트리거/유틸 함수
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- KST(UTC+9) 날짜 변환. votes.vote_date generated column 에서 사용.
-- Postgres 가 `AT TIME ZONE` 을 STABLE 로 분류해 generated 식에 직접 못 쓰므로,
-- plpgsql 함수를 IMMUTABLE 로 선언해 wrap (DST 없는 한국 기준 안전).
create or replace function public.kst_date(ts timestamptz)
returns date language plpgsql immutable parallel safe as $$
begin
  return (ts at time zone 'UTC' + interval '9 hours')::date;
end
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. 역할 enum
-- ─────────────────────────────────────────────────────────────────────
create type public.user_role as enum ('superadmin', 'admin', 'user');

-- ─────────────────────────────────────────────────────────────────────
-- 4. users (자체 회원 테이블 + Supabase auth.users 연동)
--    - email 이 unique key (로그인 식별자)
--    - password_hash 는 OAuth 사용자엔 NULL (Supabase Auth 가 따로 관리)
--    - 이메일 가입 시에도 Supabase Auth 가 bcrypt 로 안전 저장
-- ─────────────────────────────────────────────────────────────────────
create table public.users (
  sequence       bigserial primary key,
  auth_id        uuid unique references auth.users(id) on delete cascade,
  email          varchar(255) not null unique,
  password_hash  text,
  nickname       varchar(100),
  role           public.user_role not null default 'user',
  charge_channel text[] not null default '{}',
  is_blocked     boolean not null default false,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index idx_users_email    on public.users (email);
create index idx_users_nickname on public.users using gin (nickname gin_trgm_ops);

create trigger trg_users_updated before update on public.users
  for each row execute function set_updated_at();

comment on column public.users.charge_channel is 'admin 가 관리하는 채널 이름 목록';
comment on column public.users.is_blocked     is 'true 면 로그인 시 /blocked 로 리다이렉트';
comment on column public.users.password_hash  is 'OAuth 사용자는 NULL. Supabase Auth 가 실제 저장';

-- auth.users 신규 생성 시 public.users 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email, nickname, password_hash)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    case when new.encrypted_password is not null then '__supabase_managed__' else null end
  )
  on conflict (email) do update
    set auth_id  = excluded.auth_id,
        nickname = coalesce(public.users.nickname, excluded.nickname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 헬퍼: 현재 인증된 auth.uid() 의 public.users.sequence
create or replace function public.current_user_id()
returns bigint language sql stable security definer set search_path = public as $$
  select sequence from public.users where auth_id = auth.uid()
$$;

create or replace function public.is_admin_or_super()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_id = auth.uid() and role in ('admin', 'superadmin') and not is_blocked
  )
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. channels
-- ─────────────────────────────────────────────────────────────────────
create table public.channels (
  id            bigserial primary key,
  name          text not null unique,
  channel_type  text not null check (channel_type in ('tv','youtube','blog','other')),
  platform      text,
  wiki_url      text,
  thumbnail_url text,                          -- 핀에 표시할 채널 대표 이미지 (item 8)
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_channels_updated before update on public.channels
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 6. restaurants
-- ─────────────────────────────────────────────────────────────────────
create table public.restaurants (
  id               bigserial primary key,
  current_name     text not null,
  previous_name    text,
  current_address  text not null,
  previous_address text,
  cuisine          text,
  sido             text,
  sigungu          text,
  dong             text,
  lat              double precision,
  lng              double precision,
  naver_place_id   text,                        -- 네이버 지도 place id (API 조회용)
  kakao_place_id   text,
  naver_map_url    text,
  kakao_map_url    text,
  naver_rating     numeric(3,2),
  kakao_rating     numeric(3,2),
  phone            text,
  price_range      text,
  is_closed        boolean not null default false,
  notes            text,
  created_by       bigint references public.users(sequence) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (current_name, current_address)
);
create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function set_updated_at();
create index idx_restaurants_region    on public.restaurants (sido, sigungu, dong);
create index idx_restaurants_name_trgm on public.restaurants using gin (current_name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────
-- 7. appearances (음식점 ↔ 채널 N:M, 영상 단위)
-- ─────────────────────────────────────────────────────────────────────
create table public.appearances (
  id               bigserial primary key,
  restaurant_id    bigint not null references public.restaurants(id) on delete cascade,
  channel_id       bigint not null references public.channels(id)    on delete cascade,
  aired_at         date,
  episode_title    text,
  source_url       text,
  youtube_video_id text,                       -- YouTube 영상 ID (임베드용)
  thumbnail_url    text,                       -- 영상 썸네일
  summary          text,
  created_at       timestamptz not null default now()
);
create index idx_appearances_restaurant on public.appearances (restaurant_id);
create index idx_appearances_channel    on public.appearances (channel_id);

-- ─────────────────────────────────────────────────────────────────────
-- 8. votes (좋아요/싫어요 — 맛집/채널/영상 모두)
-- ─────────────────────────────────────────────────────────────────────
create table public.votes (
  id          bigserial primary key,
  user_id     bigint not null references public.users(sequence) on delete cascade,
  target_type text not null check (target_type in ('restaurant','channel','appearance')),
  target_id   bigint not null,
  value       smallint not null check (value in (1, -1)),
  created_at  timestamptz not null default now(),
  -- KST(UTC+9) 기준 날짜. public.kst_date() 가 generated 식 IMMUTABLE 요구사항을 충족하는 wrapper.
  vote_date   date generated always as (public.kst_date(created_at)) stored
);
-- 하루 1표 유니크 — 어제 이전 표는 그대로 보존됨.
create unique index votes_uniq_per_day on public.votes (user_id, target_type, target_id, vote_date);
create index idx_votes_target on public.votes (target_type, target_id);

-- ─────────────────────────────────────────────────────────────────────
-- 9. 집계 뷰
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.v_restaurant_score as
select r.id as restaurant_id, r.current_name as name,
       coalesce(sum(case when v.value =  1 then 1 end), 0) as likes,
       coalesce(sum(case when v.value = -1 then 1 end), 0) as dislikes,
       coalesce(sum(v.value), 0) as net_score
from   public.restaurants r
left   join public.votes v on v.target_type = 'restaurant' and v.target_id = r.id
group  by r.id;

create or replace view public.v_channel_score as
select c.id as channel_id, c.name as name,
       coalesce(sum(case when v.value =  1 then 1 end), 0) as likes,
       coalesce(sum(case when v.value = -1 then 1 end), 0) as dislikes,
       coalesce(sum(v.value), 0) as net_score
from   public.channels c
left   join public.votes v on v.target_type = 'channel' and v.target_id = c.id
group  by c.id;

-- 영상별 점수 (채널/맛집 조인 포함)
create or replace view public.v_appearance_score as
select a.id as appearance_id, a.restaurant_id, a.channel_id,
       a.episode_title, a.source_url, a.youtube_video_id, a.thumbnail_url, a.aired_at,
       coalesce(sum(case when v.value =  1 then 1 end), 0) as likes,
       coalesce(sum(case when v.value = -1 then 1 end), 0) as dislikes,
       coalesce(sum(v.value), 0) as net_score
from   public.appearances a
left   join public.votes v on v.target_type = 'appearance' and v.target_id = a.id
group  by a.id;

-- 맛집별 상위 2개 영상 (좋아요 최다, 동률은 최신순)
-- item 9: 핀 클릭 시 좋아요 최다 영상 2개 표시
create or replace view public.v_top2_appearances as
select * from (
  select s.*,
    row_number() over (
      partition by s.restaurant_id
      order by s.likes desc, s.aired_at desc nulls last
    ) as rn
  from public.v_appearance_score s
) ranked
where rn <= 2;

-- 인기 급상승 (item 13)
-- 로직: 최근 7일간 좋아요 수에 가중치 3 + 누적 좋아요 수 기본 1.
-- 즉 trend_score = 3 * recent_likes + (total_likes - recent_likes)
-- 7일 전엔 묻혀있다가 갑자기 좋아요 받기 시작한 영상이 위로 올라옴.
create or replace view public.v_trending_appearances as
select
  a.id              as appearance_id,
  a.restaurant_id,
  a.channel_id,
  a.episode_title,
  a.source_url,
  a.youtube_video_id,
  a.thumbnail_url,
  a.aired_at,
  recent.recent_likes,
  total.total_likes,
  (recent.recent_likes * 3 + (total.total_likes - recent.recent_likes))::numeric as trend_score
from public.appearances a
left join lateral (
  select count(*)::int as recent_likes
  from public.votes v
  where v.target_type = 'appearance' and v.target_id = a.id
        and v.value = 1 and v.created_at > now() - interval '7 days'
) recent on true
left join lateral (
  select count(*)::int as total_likes
  from public.votes v
  where v.target_type = 'appearance' and v.target_id = a.id and v.value = 1
) total on true;

-- ─────────────────────────────────────────────────────────────────────
-- 10. RLS
-- ─────────────────────────────────────────────────────────────────────
alter table public.users        enable row level security;
alter table public.channels     enable row level security;
alter table public.restaurants  enable row level security;
alter table public.appearances  enable row level security;
alter table public.votes        enable row level security;

-- 읽기: 누구나
create policy "channels readable"     on public.channels     for select using (true);
create policy "restaurants readable"  on public.restaurants  for select using (true);
create policy "appearances readable"  on public.appearances  for select using (true);
create policy "votes readable"        on public.votes        for select using (true);

-- users: 본인은 자기 row 읽기/수정. superadmin 은 전체 read/update.
create policy "users self read" on public.users for select
  using (auth_id = auth.uid()
         or exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'superadmin'));
create policy "users self update" on public.users for update
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- 채널/맛집/영상: admin/superadmin 만 쓰기 가능 (service_role 은 RLS 우회)
create policy "channels admin write"    on public.channels    for all
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "restaurants admin write" on public.restaurants for all
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "appearances admin write" on public.appearances for all
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- 투표: 본인이 본인 user_id 로만
create policy "votes self insert" on public.votes for insert
  with check (user_id = public.current_user_id());
create policy "votes self update" on public.votes for update
  using (user_id = public.current_user_id());
create policy "votes self delete" on public.votes for delete
  using (user_id = public.current_user_id());
