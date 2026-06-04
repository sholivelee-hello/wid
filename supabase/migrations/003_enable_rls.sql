-- RLS 활성화 — Realtime Broadcast 도입 전제 (2026-06-04).
-- 서버는 service role 키로 RLS를 우회하지만, anon 키는 브라우저(Realtime
-- 구독)용으로 노출된다. RLS를 켜고 정책을 만들지 않으면 anon은 어떤 행도
-- 읽고/쓸 수 없으므로(완전 차단), 브라우저는 데이터가 실리지 않는 공개
-- broadcast 채널(wid-tasks)만 사용하게 된다 — docs/architecture/realtime.md.
-- 정책 없음 = service role 외 전면 차단.

alter table public.tasks enable row level security;
alter table public.issues enable row level security;
alter table public.custom_statuses enable row level security;
alter table public.gcal_oauth enable row level security;
alter table public.jira_events enable row level security;
alter table public.notion_status_mappings enable row level security;
alter table public.slack_events enable row level security;
