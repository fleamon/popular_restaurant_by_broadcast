-- 마이그레이션 #0003 : 전체 스키마 재구성
-- v1 (profiles 기반) → v2 (users 자체 테이블 + role enum + charge_channel + 영상 점수 뷰).
-- 적용: ../schema.sql 전체를 그대로 실행한다 (DROP CASCADE + CREATE 가 들어 있어 안전).
\i ../schema.sql
