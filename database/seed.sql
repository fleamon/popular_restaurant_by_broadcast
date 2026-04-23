-- 로컬·데모용 시드. 운영 DB에는 넣지 말 것.
-- 실행 전 schema.sql 적용 완료 가정.

insert into public.channels (name, channel_type, platform, wiki_url) values
  ('백종원의 3대천왕', 'tv',      'SBS',         'https://ko.wikipedia.org/wiki/%EB%B0%B1%EC%A2%85%EC%9B%90%EC%9D%98_3%EB%8C%80%EC%B2%9C%EC%99%95'),
  ('수요미식회',      'tv',      'tvN',         'https://namu.wiki/w/%EC%88%98%EC%9A%94%EB%AF%B8%EC%8B%9D%ED%9A%8C'),
  ('맛상무',          'youtube', 'YouTube',     'https://namu.wiki/w/%EB%A7%9B%EC%83%81%EB%AC%B4')
on conflict (name) do nothing;

insert into public.restaurants (current_name, current_address, cuisine, sido, sigungu, dong, lat, lng, notes) values
  ('을지로 골뱅이집', '서울 중구 을지로 ...', '한식', '서울특별시', '중구', '을지로동', 37.5663, 126.9921, '데모 데이터 🐚'),
  ('연남 파스타바',    '서울 마포구 ...',      '양식', '서울특별시', '마포구', '연남동',   37.5604, 126.9239, '데모 데이터 🍝')
on conflict (current_name, current_address) do nothing;
