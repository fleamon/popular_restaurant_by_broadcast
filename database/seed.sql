-- 백안맛지도 더미 시드 (테스트용 120+ 레스토랑)
-- 실행 전 schema.sql 적용 완료 가정. 멱등성: ON CONFLICT 로 재실행 안전.

-- ─────────────────────────────────────────────────────────────────────
-- 1. 채널 (8개 — TV / YouTube / Blog 다양)
-- ─────────────────────────────────────────────────────────────────────
insert into public.channels (name, channel_type, platform, wiki_url) values
  ('백종원의 3대천왕',           'tv',      'SBS',          'https://ko.wikipedia.org/wiki/%EB%B0%B1%EC%A2%85%EC%9B%90%EC%9D%98_3%EB%8C%80%EC%B2%9C%EC%99%95'),
  ('수요미식회',                  'tv',      'tvN',          'https://namu.wiki/w/%EC%88%98%EC%9A%94%EB%AF%B8%EC%8B%9D%ED%9A%8C'),
  ('생활의 달인',                 'tv',      'SBS',          null),
  ('식객 허영만의 백반기행',     'tv',      'TV조선',       null),
  ('맛상무',                       'youtube', 'YouTube',     'https://namu.wiki/w/%EB%A7%9B%EC%83%81%EB%AC%B4'),
  ('영자씨의 부엌',               'youtube', 'YouTube',     null),
  ('이연복의 사부의 비법',        'youtube', 'YouTube',     null),
  ('김씨네 맛집블로그',           'blog',    '네이버블로그', null)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 2. 레스토랑 120개 — generate_series + 배열 인덱싱으로 다양성 확보
-- ─────────────────────────────────────────────────────────────────────
with base as (
  select
    g                                            as n,
    (array['서울특별시','경기도','부산광역시','인천광역시','대구광역시',
           '광주광역시','대전광역시','울산광역시','강원특별자치도','제주특별자치도'])[1 + (g % 10)]
                                                 as sido,
    (array['한식','일식','중식','양식','분식','카페','베이커리','디저트','아시안','패스트푸드'])[1 + (g % 10)]
                                                 as cuisine,
    (array['중구','강남구','종로구','마포구','용산구','성동구','송파구','서초구','노원구','구로구'])[1 + (g % 10)]
                                                 as sigungu,
    (array['명동','역삼동','종로1가','연남동','이태원동','성수동','잠실동','서초동','상계동','구로동'])[1 + (g % 10)]
                                                 as dong,
    (array['청담돈가스','을지골뱅이','종로빈대떡','연남파스타','홍대피자','강남곱창','명동칼국수',
           '이태원케밥','성수커피','잠실국밥','홍대떡볶이','강북부대찌개','서초샌드위치','용산초밥',
           '신촌치킨','마포곰탕','광장순대국','목동돈까스','왕십리파전','부산밀면'])[1 + (g % 20)]
                                                 as base_name
  from generate_series(1, 120) g
)
insert into public.restaurants
  (current_name, current_address, cuisine, sido, sigungu, dong, lat, lng, naver_map_url, kakao_map_url, notes)
select
  base_name || ' ' || sido || ' ' || n::text || '호점'                              as current_name,
  sido || ' ' || sigungu || ' ' || dong || ' ' || (1 + (n % 200))::text || '-' || (1 + (n % 50))::text   as current_address,
  cuisine,
  sido,
  sigungu,
  dong,
  -- 광역단체별 대략 좌표 + 랜덤 오프셋
  case sido
    when '서울특별시'        then 37.5665 + (random() - 0.5) * 0.10
    when '경기도'            then 37.4138 + (random() - 0.5) * 0.40
    when '부산광역시'        then 35.1796 + (random() - 0.5) * 0.10
    when '인천광역시'        then 37.4563 + (random() - 0.5) * 0.10
    when '대구광역시'        then 35.8714 + (random() - 0.5) * 0.10
    when '광주광역시'        then 35.1595 + (random() - 0.5) * 0.10
    when '대전광역시'        then 36.3504 + (random() - 0.5) * 0.10
    when '울산광역시'        then 35.5384 + (random() - 0.5) * 0.10
    when '강원특별자치도'    then 37.8228 + (random() - 0.5) * 0.50
    when '제주특별자치도'    then 33.4996 + (random() - 0.5) * 0.20
  end                                                                              as lat,
  case sido
    when '서울특별시'        then 126.9780 + (random() - 0.5) * 0.10
    when '경기도'            then 127.5183 + (random() - 0.5) * 0.50
    when '부산광역시'        then 129.0756 + (random() - 0.5) * 0.10
    when '인천광역시'        then 126.7052 + (random() - 0.5) * 0.10
    when '대구광역시'        then 128.6014 + (random() - 0.5) * 0.10
    when '광주광역시'        then 126.8526 + (random() - 0.5) * 0.10
    when '대전광역시'        then 127.3845 + (random() - 0.5) * 0.10
    when '울산광역시'        then 129.3114 + (random() - 0.5) * 0.10
    when '강원특별자치도'    then 128.1555 + (random() - 0.5) * 0.60
    when '제주특별자치도'    then 126.5312 + (random() - 0.5) * 0.30
  end                                                                              as lng,
  null, null,
  '🍽 더미 데이터 — 테스트용'                                                       as notes
from base
on conflict (current_name, current_address) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Appearances — 각 레스토랑마다 1~3개 무작위 채널 등장
-- ─────────────────────────────────────────────────────────────────────
with restaurants_to_seed as (
  select id, current_name from public.restaurants where notes like '🍽 더미%'
),
appearance_plan as (
  select
    r.id           as restaurant_id,
    r.current_name as restaurant_name,
    n              as seq
  from restaurants_to_seed r,
       lateral generate_series(1, 1 + (random() * 2)::int) as n
)
insert into public.appearances (restaurant_id, channel_id, aired_at, episode_title, source_url, summary)
select
  ap.restaurant_id,
  -- 각 row 마다 무작위 채널 1개 (Postgres 의 lateral subquery 로)
  (select id from public.channels order by random() limit 1)                       as channel_id,
  current_date - (random() * 365 * 5)::int                                         as aired_at,
  ap.restaurant_name || ' 방영 ' || ap.seq || '회'                                 as episode_title,
  -- 60% 확률로 YouTube/원본 링크 첨부
  case when random() < 0.6
       then 'https://www.youtube.com/watch?v=demo_' || ap.restaurant_id || '_' || ap.seq
       else null
  end                                                                              as source_url,
  '🎬 ' || ap.restaurant_name || ' — 시청자 추천 맛집'                             as summary
from appearance_plan ap;

-- ─────────────────────────────────────────────────────────────────────
-- 4. 결과 요약 (실행 후 SELECT 로 확인)
-- ─────────────────────────────────────────────────────────────────────
-- select count(*) restaurants from public.restaurants;
-- select count(*) appearances  from public.appearances;
-- select sido, count(*) from public.restaurants group by sido order by sido;
-- select cuisine, count(*) from public.restaurants group by cuisine order by cuisine;
