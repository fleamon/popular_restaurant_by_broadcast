-- 0013_remove_dislikes.sql
-- 싫어요(-1) 완전 제거 — UI 는 이미 좋아요만 노출. 데이터·향후 입력을 원천 차단.
--
-- 정책: 랭킹 점수 뷰(v_*_score)는 그대로 두어(dislikes 는 항상 0, net_score = likes)
--       다수의 랭킹/점수 쿼리 호환을 유지한다. 데이터 삭제 + 제약으로 싫어요를 차단.
--
-- ⚠ value=-1 행이 영구 삭제된다(되돌릴 수 없음).

-- 1) 기존 싫어요 투표 삭제
delete from public.votes where value = -1;

-- 2) 향후 좋아요(1)만 허용 — 제약 교체
alter table public.votes drop constraint if exists votes_value_check;
alter table public.votes add  constraint votes_value_check check (value = 1);
