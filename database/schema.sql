-- 백안맛지도 Supabase 초기 스키마
-- 실행: Supabase Dashboard → SQL Editor 전체 붙여넣기 또는 psql로 전체 실행
-- 전제: Supabase 기본 확장 pgcrypto, uuid-ossp 활성화

-- ─────────────────────────────────────────────────────────────────────
-- 0. 공통 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 1. channels : 맛집이 소개된 방송/미디어 채널
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.channels (
  id            bigserial primary key,
  name          text        not null unique,
  channel_type  text        not null check (channel_type in ('tv','youtube','blog','other')),
  platform      text,                         -- SBS, KBS, YouTube 채널명 등
  wiki_url      text,                         -- 수집 소스(위키/나무위키)
  thumbnail_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_channels_updated before update on public.channels
  for each row execute function set_updated_at();
comment on table  public.channels is '맛집을 소개한 방송/유튜브/블로그 채널 마스터';
comment on column public.channels.channel_type is 'tv/youtube/blog/other';

-- ─────────────────────────────────────────────────────────────────────
-- 2. restaurants : 맛집 마스터 (상호 변경·이전 이력 포함)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.restaurants (
  id               bigserial primary key,
  current_name     text        not null,
  previous_name    text,                       -- 상호 변경 시 이전 이름
  current_address  text        not null,
  previous_address text,                       -- 이전 주소(이전 시)
  cuisine          text,                       -- 한식/양식/일식/중식/카페/분식/…
  sido             text,                       -- 시/도 (검색 필터)
  sigungu          text,                       -- 시/군/구
  dong             text,                       -- 동/읍/면
  lat              double precision,
  lng              double precision,
  naver_map_url    text,
  kakao_map_url    text,
  naver_rating     numeric(3,2),
  kakao_rating     numeric(3,2),
  phone            text,
  price_range      text,                       -- 가성비/중가/고가
  is_closed        boolean     not null default false,
  notes            text,                       -- 자유 메모(이모지 허용 😋)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (current_name, current_address)
);
create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function set_updated_at();
create index if not exists idx_restaurants_region on public.restaurants (sido, sigungu, dong);
create index if not exists idx_restaurants_name_trgm on public.restaurants using gin (current_name gin_trgm_ops);
-- pg_trgm 확장이 없으면 Supabase에서 먼저 활성화: create extension if not exists pg_trgm;
comment on table public.restaurants is '맛집 마스터. 상호/주소 변경 이력 컬럼 포함';

-- ─────────────────────────────────────────────────────────────────────
-- 3. appearances : 맛집 ↔ 채널 N:M + 방송 회차 정보
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.appearances (
  id            bigserial primary key,
  restaurant_id bigint      not null references public.restaurants(id) on delete cascade,
  channel_id    bigint      not null references public.channels(id)    on delete cascade,
  aired_at      date,                          -- 방송/업로드 일자
  episode_title text,
  source_url    text,                          -- YouTube 영상 등 원본 링크
  summary       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_appearances_restaurant on public.appearances (restaurant_id);
create index if not exists idx_appearances_channel    on public.appearances (channel_id);
comment on table public.appearances is '맛집이 어느 채널에 언제 소개되었는지. 여러 번 소개되면 여러 row';

-- ─────────────────────────────────────────────────────────────────────
-- 4. profiles : Supabase auth.users 확장 (닉네임·admin 플래그)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  nickname   text,
  avatar_url text,
  is_admin   boolean     not null default false,
  created_at timestamptz not null default now()
);
comment on column public.profiles.is_admin is 'true일 때 DB 관리 탭 및 /admin 접근 허용';

-- auth.users insert 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- 5. votes : 좋아요/싫어요 (polymorphic target)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.votes (
  id          bigserial primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  target_type text        not null check (target_type in ('restaurant','channel','appearance')),
  target_id   bigint      not null,
  value       smallint    not null check (value in (1, -1)),  -- 1=좋아요, -1=싫어요
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)     -- 아이디별 대상당 1회
);
create index if not exists idx_votes_target on public.votes (target_type, target_id);
comment on table public.votes is '아이디별 대상(맛집/채널/회차)에 좋아요(1) 또는 싫어요(-1) 1회';

-- ─────────────────────────────────────────────────────────────────────
-- 6. tags / restaurant_tags (MVP 확장 스텁 — 필요해질 때 활성화)
-- ─────────────────────────────────────────────────────────────────────
-- create table if not exists public.tags (
--   id         bigserial primary key,
--   name       text unique not null,         -- 예: "혼밥OK", "가성비", "웨이팅必"
--   created_at timestamptz not null default now()
-- );
-- create table if not exists public.restaurant_tags (
--   restaurant_id bigint not null references public.restaurants(id) on delete cascade,
--   tag_id        bigint not null references public.tags(id)        on delete cascade,
--   primary key (restaurant_id, tag_id)
-- );

-- ─────────────────────────────────────────────────────────────────────
-- 7. 집계 뷰
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.v_restaurant_score as
select r.id                                                 as restaurant_id,
       r.current_name                                       as name,
       coalesce(sum(case when v.value =  1 then 1 end), 0)  as likes,
       coalesce(sum(case when v.value = -1 then 1 end), 0)  as dislikes,
       coalesce(sum(v.value), 0)                            as net_score
from   public.restaurants r
left   join public.votes v
       on v.target_type = 'restaurant' and v.target_id = r.id
group  by r.id;

create or replace view public.v_channel_score as
select c.id                                                 as channel_id,
       c.name                                               as name,
       coalesce(sum(case when v.value =  1 then 1 end), 0)  as likes,
       coalesce(sum(case when v.value = -1 then 1 end), 0)  as dislikes,
       coalesce(sum(v.value), 0)                            as net_score
from   public.channels c
left   join public.votes v
       on v.target_type = 'channel' and v.target_id = c.id
group  by c.id;

-- 맛집별 대표 회차(= 좋아요 최다 appearance). 동률이면 최신 aired_at.
create or replace view public.v_top_representative_appearance as
select distinct on (a.restaurant_id)
       a.restaurant_id,
       a.id          as appearance_id,
       a.channel_id,
       a.aired_at,
       coalesce(sum(case when v.value = 1 then 1 end), 0) as likes
from   public.appearances a
left   join public.votes v
       on v.target_type = 'appearance' and v.target_id = a.id
group  by a.id
order  by a.restaurant_id, likes desc, a.aired_at desc nulls last;

-- ─────────────────────────────────────────────────────────────────────
-- 8. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────
alter table public.channels     enable row level security;
alter table public.restaurants  enable row level security;
alter table public.appearances  enable row level security;
alter table public.profiles     enable row level security;
alter table public.votes        enable row level security;

-- 읽기: 누구나
create policy "channels readable"     on public.channels     for select using (true);
create policy "restaurants readable"  on public.restaurants  for select using (true);
create policy "appearances readable"  on public.appearances  for select using (true);
create policy "profiles readable"     on public.profiles     for select using (true);
create policy "votes readable"        on public.votes        for select using (true);

-- 쓰기(맛집/채널/회차): admin만. data 수집 스크립트는 service_role 키를 써서 RLS bypass.
create policy "channels admin write"    on public.channels    for all
  using    (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check(exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "restaurants admin write" on public.restaurants for all
  using    (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check(exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "appearances admin write" on public.appearances for all
  using    (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check(exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 프로필: 본인만 수정 가능
create policy "profiles self update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- 투표: 본인이 본인 id로만 insert/update/delete
create policy "votes self write" on public.votes for insert with check (auth.uid() = user_id);
create policy "votes self modify" on public.votes for update using (auth.uid() = user_id);
create policy "votes self delete" on public.votes for delete using (auth.uid() = user_id);
