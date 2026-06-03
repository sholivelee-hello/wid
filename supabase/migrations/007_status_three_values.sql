-- 상태값을 등록 · 완료 · 취소 3개로 단순화 (위임 제거).
-- 위임은 더 이상 status가 아니라 delegate_to 필드로만 표현한다.
-- 기존 '위임' 상태 행은 '등록'으로 이전하되 delegate_to 값은 그대로 보존한다.
-- 완료 상태는 절대 건드리지 않는다.

update tasks set status = '등록' where status = '위임';

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('등록', '완료', '취소'));
