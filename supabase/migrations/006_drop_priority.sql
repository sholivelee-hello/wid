-- 우선순위 필드 전면 제거 (사용자 결정 2026-06-03 — 기존 값 폐기).
-- 코드에서 priority 참조가 모두 사라진 뒤(배포 완료) 실행해야 안전:
-- 옛 코드가 운영에 살아있는 동안 drop하면 insert가 전부 500.
alter table tasks drop column if exists priority;
