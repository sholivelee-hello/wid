-- JIRA 웹훅 연동: 알림 3종(나에게 할당 · 댓글 멘션 · 내 이슈에 새 댓글)을
-- WID TASK로 들여온다. source enum의 'jira' 값은 008에서 이미 허용됨.

alter table tasks add column if not exists jira_url text;
alter table tasks add column if not exists jira_issue_key text;

-- JIRA 웹훅 이벤트 중복 방지 (slack_events와 동일 패턴).
-- event_key 예: assign:10001:12345 (이슈id:changelog id), comment:67890 (댓글 id)
create table if not exists jira_events (
  event_key text primary key,
  created_at timestamptz not null default now()
);
