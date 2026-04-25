-- 002_issue_hierarchy.sql
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  deadline date,
  sort_mode text NOT NULL DEFAULT 'checklist'
    CHECK (sort_mode IN ('checklist','sequential')),
  position integer NOT NULL DEFAULT 0,
  notion_issue_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS issues_position_idx ON issues (position) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS issues_notion_idx ON issues (notion_issue_id) WHERE notion_issue_id IS NOT NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_mode text NOT NULL DEFAULT 'checklist'
    CHECK (sort_mode IN ('checklist','sequential')),
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_no_dual_parent;
ALTER TABLE tasks ADD CONSTRAINT tasks_no_dual_parent
  CHECK (NOT (issue_id IS NOT NULL AND parent_task_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS tasks_issue_idx ON tasks (issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;
