-- 보류(pending) soft-flag: 휴지통 is_deleted 패턴과 동일. null = 활성.
alter table tasks add column if not exists pending_at timestamptz;
alter table issues add column if not exists pending_at timestamptz;

create index if not exists idx_task_pending on tasks(pending_at) where pending_at is not null and not is_deleted;
create index if not exists idx_issue_pending on issues(pending_at) where pending_at is not null and not is_deleted;
