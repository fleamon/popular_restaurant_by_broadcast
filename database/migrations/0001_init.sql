-- 마이그레이션 #0001 : 초기 스키마
-- schema.sql과 동일한 내용을 마이그레이션 파일로 보관. 버전 추적용.
-- 신규 환경 세팅: Supabase SQL Editor에 ../schema.sql 한 번 실행으로 충분.
-- 이후 변경은 0002_*, 0003_* 순서로 append-only 추가.

\i ../schema.sql
