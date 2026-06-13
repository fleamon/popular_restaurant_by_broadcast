-- 0012_visitors_count_rpc.sql
-- 누적 unique 방문자 수를 DB 측에서 계산하는 RPC.
-- 기존 get_stats 는 전체 visitor_id 를 앱 메모리로 받아 set() 으로 distinct → 데이터 폭증 시 OOM.
-- count(distinct) 를 DB 에서 수행하도록 함수로 분리.

create or replace function public.count_distinct_visitors()
returns bigint
language sql
stable
as $$
  select count(distinct visitor_id) from public.visits;
$$;
