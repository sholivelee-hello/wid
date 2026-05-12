-- Reduce task status set to: 등록, 완료, 위임, 취소.
-- 기존에 '진행중'/'대기중' 상태였던 행은 '등록'으로 이전.

update tasks set status = '등록' where status in ('진행중', '대기중');

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('등록', '완료', '위임', '취소'));
