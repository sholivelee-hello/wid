-- 노션発 task 이름 보호 플래그. 사용자가 WID UI에서 노션 task 이름을
-- 수정하면 true로 세팅되고, 이후 노션 동기화는 그 task의 제목을 덮어쓰지
-- 않는다 (완료 동기화는 notion_task_id 매칭이라 이름과 무관하게 동작).
alter table tasks
  add column if not exists name_locked boolean not null default false;

-- jira 슬롯 예약 — source enum에 'jira'를 허용값으로만 추가한다.
-- 아이콘·실연동은 이번 범위 밖(별도 스펙). 값만 받을 수 있게 제약 갱신.
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'notion', 'slack', 'jira'));
