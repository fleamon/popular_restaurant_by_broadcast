-- 0008_reject_pending_restaurant_requests.sql
-- 일회성 정리 — 기존에 쌓여 있던 '맛집/영상 수정·삭제 요청' 중 status='요청' 인 것을 모두 '반려' 로.
--
-- 사유: payload 스키마가 before/after 페어로 변경되어, 기존 단일 payload 는 새 승인 UI 와 호환되지 않음.
-- 그대로 두면 가독성 떨어지는 옛 페이로드가 계속 보이므로 일괄 반려 처리.

update public.requests
   set status = '반려'
 where type   in ('restaurant_edit', 'restaurant_delete')
   and status = '요청';
