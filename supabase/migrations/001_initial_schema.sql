-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Task table
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  priority text not null default '보통' check (priority in ('긴급', '높음', '보통', '낮음')),
  status text not null default '대기',
  source text not null default 'manual' check (source in ('manual', 'notion', 'slack')),
  requester text,
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  deadline timestamptz,
  completed_at timestamptz,
  notion_task_id text unique,
  slack_url text,
  slack_channel text,
  slack_sender text,
  delegate_to text,
  follow_up_note text,
  is_deleted boolean not null default false
);

-- CustomStatus table
create table custom_statuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text not null default '#6B7280',
  created_at timestamptz not null default now()
);

-- Slack event dedup table
create table slack_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

-- Notion status mapping table
create table notion_status_mappings (
  id uuid primary key default uuid_generate_v4(),
  notion_status text not null unique,
  wid_status text not null
);

-- Indexes
create index idx_task_status_deleted on tasks(status, is_deleted);
create index idx_task_created_at on tasks(created_at);
create index idx_task_completed_at on tasks(completed_at);
