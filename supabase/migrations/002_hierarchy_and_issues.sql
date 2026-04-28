-- Issues table
create table if not exists issues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  deadline timestamptz,
  sort_mode text not null default 'checklist' check (sort_mode in ('checklist', 'sequential')),
  position integer not null default 0,
  notion_issue_id text unique,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

-- Add missing columns to tasks
alter table tasks
  add column if not exists issue_id uuid references issues(id) on delete set null,
  add column if not exists parent_task_id uuid references tasks(id) on delete set null,
  add column if not exists sort_mode text not null default 'checklist',
  add column if not exists position integer not null default 0;

-- Fix status default and constraint
alter table tasks alter column status set default '등록';
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('등록', '진행중', '대기중', '완료', '위임', '취소'));

-- Indexes
create index if not exists idx_issue_position on issues(position) where not is_deleted;
create index if not exists idx_task_issue_id on tasks(issue_id) where not is_deleted;
create index if not exists idx_task_parent_id on tasks(parent_task_id) where not is_deleted;
create index if not exists idx_task_position on tasks(position);
