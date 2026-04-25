# ISSUE / TASK Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-level hierarchy (ISSUE → TASK → sub-TASK) to WID so the user can group related tasks, surface easily-missed sub-items in the inbox, and reorganize work via drag-and-drop, while keeping independent tasks intact.

**Architecture:** Introduce a lightweight `Issue` entity (no status/timer) plus two new fields on `Task` (`issue_id`, `parent_task_id`) and ordering metadata. The inbox renders a recursive tree filtered to incomplete items. A new `/issues/[id]` page provides a wide management surface. Drag-and-drop uses `@dnd-kit`. Hard rule: a TASK can only complete after all its sub-TASKs complete; soft sequential dependency between siblings shows a lock badge but does not block.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui v4, `@dnd-kit/core` + `@dnd-kit/sortable` (new), localStorage, mock data (Supabase later).

**Spec:** `docs/superpowers/specs/2026-04-25-issue-task-hierarchy-design.md`

**Testing convention:** This repo has no test framework. Each task verifies via `npm run build` (compile/type check), `npm run lint`, and **manual browser check at http://localhost:3000** with `npm run dev`. Steps explicitly state the click path / DOM behavior to confirm.

**Identity check before commit:** This project lives under `~/Desktop/Project/TOY/` with `includeIf` auto-routing git identity to `sholivelee@gmail.com`. Verify once after the first commit with `git log -1 --pretty=format:"%ae"` — should print the personal email.

---

## File Structure

### New files
```
src/
├── app/
│   ├── api/
│   │   └── issues/
│   │       ├── route.ts                     # GET list, POST create
│   │       ├── [id]/
│   │       │   ├── route.ts                 # GET, PATCH, DELETE
│   │       │   └── tasks/
│   │       │       └── route.ts             # GET tasks of one issue (for /issues/[id])
│   └── issues/
│       └── [id]/
│           └── page.tsx                     # Wide ISSUE management page
├── components/
│   ├── issues/
│   │   ├── issue-row.tsx                    # Inbox ISSUE row (collapsible header)
│   │   ├── issue-form.tsx                   # Create/edit form (name, color, deadline, sort_mode)
│   │   ├── issue-picker.tsx                 # Modal: pick existing ISSUE or create new
│   │   ├── issue-delete-dialog.tsx          # Cascade option dialog
│   │   └── issue-tree.tsx                   # Recursive tree of TASK + sub-TASK rows
│   └── inbox/
│       └── inbox-tree.tsx                   # Top-level inbox: ISSUE rows + independent TASK rows
└── lib/
    ├── hierarchy.ts                         # Tree utils (group, filter, position math)
    ├── lock-state.ts                        # Sequential mode lock + completion-block calc
    ├── use-tree-collapsed.ts                # Hook: localStorage collapse state per id
    ├── use-panel-width.ts                   # Hook: TASK panel width (resizable)
    └── mock-issues.ts                       # Mock ISSUE data
supabase/
└── migrations/
    └── 002_issue_hierarchy.sql              # ISSUE table + TASK FK columns
```

### Modified files
```
src/
├── app/
│   ├── page.tsx                             # Inbox: switch to <InboxTree />, add filter rule + + 새 ISSUE button
│   ├── api/
│   │   ├── tasks/route.ts                   # Include issue_id, parent_task_id, position, sort_mode in response + PATCH supports them
│   │   ├── tasks/[id]/route.ts              # PATCH supports new fields, completion guard
│   │   └── notion/sync/route.ts             # Map Notion ISSUE relation → Issue rows + attach
├── components/
│   └── tasks/
│       ├── task-card.tsx                    # Lock visual, expand toggle, indent style for sub
│       └── task-detail-panel.tsx            # ISSUE field + picker + unlink + width handle
├── lib/
│   ├── types.ts                             # Add Issue, extend Task fields
│   ├── mock-data.ts                         # Add issue_id / parent_task_id / position / sort_mode + 2~3 sample hierarchies
│   └── api.ts                               # (if needed) helpers for /api/issues
package.json                                 # Add @dnd-kit/core, @dnd-kit/sortable
```

---

## Phase 1 — Data foundation

### Task 1: Add `Issue` type and extend `Task` type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add Issue interface and extend Task**

Append/insert in `src/lib/types.ts`:

```ts
export type SortMode = 'checklist' | 'sequential';

export interface Issue {
  id: string;
  name: string;
  color: string;                  // hex like '#94a3b8'
  deadline: string | null;        // ISO date string (YYYY-MM-DD)
  sort_mode: SortMode;
  position: number;
  notion_issue_id: string | null;
  created_at: string;
  is_deleted: boolean;
}
```

In the existing `Task` interface, add four fields just before `is_deleted`:

```ts
issue_id: string | null;
parent_task_id: string | null;
sort_mode: SortMode;             // applies when this TASK has sub-TASKs
position: number;
```

- [ ] **Step 2: Type check**

Run: `npm run build`
Expected: Build fails (mock data + components don't yet supply new fields). That is the point — Phase 1 will keep failing until Task 2 fills mocks.

Note for engineer: do NOT commit yet. Tasks 1+2+3 land together as one "data foundation" commit since they only become valid as a set.

---

### Task 2: Add mock issues + extend mock tasks

**Files:**
- Create: `src/lib/mock-issues.ts`
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 1: Create `src/lib/mock-issues.ts`**

```ts
import { Issue } from './types';

const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const now = new Date().toISOString();

export const MOCK_ISSUES: Issue[] = [
  {
    id: id(1),
    name: '회원가입 플로우 개편',
    color: '#3b82f6',
    deadline: null,
    sort_mode: 'sequential',
    position: 0,
    notion_issue_id: 'notion-issue-001',
    created_at: now,
    is_deleted: false,
  },
  {
    id: id(2),
    name: '결제 모듈 리뷰',
    color: '#f59e0b',
    deadline: null,
    sort_mode: 'checklist',
    position: 1,
    notion_issue_id: null,
    created_at: now,
    is_deleted: false,
  },
];
```

- [ ] **Step 2: Extend every existing MOCK_TASKS entry**

In `src/lib/mock-data.ts`, after the existing imports add the helper and update each task literal:

```ts
import { MOCK_ISSUES } from './mock-issues';
```

For every task object, add the four new fields. Default for independent tasks:

```ts
issue_id: null,
parent_task_id: null,
sort_mode: 'checklist',
position: 0,
```

Then change two existing tasks to belong to ISSUE id(1) (sequential) and add three sub-TASKs underneath one of them. Insert a small block of new MOCK_TASKS entries (use ids 100+ to avoid collisions) so the inbox has at least one fully populated 3-level hierarchy when the UI lands. Example block to append at the end of MOCK_TASKS:

```ts
{
  id: id(100), title: '회원가입 시안 검토', description: null,
  priority: '높음', status: '진행중', source: 'manual',
  requester: null, requested_at: null, created_at: hoursAgo(2),
  deadline: null, started_at: null, completed_at: null,
  actual_duration: null, is_duration_manual: false,
  notion_task_id: null, slack_url: null, notion_issue: null,
  slack_channel: null, slack_sender: null, delegate_to: null, follow_up_note: null,
  is_deleted: false,
  issue_id: '10000000-0000-0000-0000-000000000001',
  parent_task_id: null, sort_mode: 'checklist', position: 0,
},
{
  id: id(101), title: '체크박스 라벨 정리', description: null,
  priority: '보통', status: '대기', source: 'manual',
  requester: null, requested_at: null, created_at: hoursAgo(1),
  deadline: null, started_at: null, completed_at: null,
  actual_duration: null, is_duration_manual: false,
  notion_task_id: null, slack_url: null, notion_issue: null,
  slack_channel: null, slack_sender: null, delegate_to: null, follow_up_note: null,
  is_deleted: false,
  issue_id: null,
  parent_task_id: '00000000-0000-0000-0000-000000000100', sort_mode: 'checklist', position: 0,
},
{
  id: id(102), title: '에러 메시지 카피', description: null,
  priority: '낮음', status: '대기', source: 'manual',
  requester: null, requested_at: null, created_at: hoursAgo(1),
  deadline: null, started_at: null, completed_at: null,
  actual_duration: null, is_duration_manual: false,
  notion_task_id: null, slack_url: null, notion_issue: null,
  slack_channel: null, slack_sender: null, delegate_to: null, follow_up_note: null,
  is_deleted: false,
  issue_id: null,
  parent_task_id: '00000000-0000-0000-0000-000000000100', sort_mode: 'checklist', position: 1,
},
```

(Engineer: cross-check the `id(n)` template above — `id` here uses `00000000-0000-0000-0000-` prefix from existing helper. The example uses literal strings to avoid the prefix mismatch with `id(100)` which produces `00000000-0000-0000-0000-000000000100`. Use whichever helper is already defined; keep ids unique.)

- [ ] **Step 3: Type check**

Run: `npm run build`
Expected: Compiles cleanly now. (API routes still ignore new fields — that's Task 4-6.)

---

### Task 3: Supabase migration file

**Files:**
- Create: `supabase/migrations/002_issue_hierarchy.sql`

- [ ] **Step 1: Write migration**

```sql
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
```

- [ ] **Step 2: Commit Phase 1**

```bash
git add src/lib/types.ts src/lib/mock-issues.ts src/lib/mock-data.ts supabase/migrations/002_issue_hierarchy.sql
git commit -m "feat(types): add Issue entity and hierarchy fields on Task

Adds Issue (lightweight container) and four hierarchy fields on Task
(issue_id, parent_task_id, sort_mode, position). Mock data now
includes one sequential ISSUE with two TASKs and two sub-TASKs so
the upcoming UI has something real to render. Supabase migration
mirrors the schema for the eventual real backend."
git log -1 --pretty=format:"%h %ae"
# Expected: hash followed by sholivelee@gmail.com
```

---

## Phase 2 — API routes

### Task 4: `/api/issues` — list and create

**Files:**
- Create: `src/app/api/issues/route.ts`

- [ ] **Step 1: Implement route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Issue } from '@/lib/types';
import { MOCK_ISSUES } from '@/lib/mock-issues';

// In-memory mutable copy for the dev-mock backend
let issues: Issue[] = [...MOCK_ISSUES];

export async function GET() {
  const visible = issues
    .filter(i => !i.is_deleted)
    .sort((a, b) => a.position - b.position);
  return NextResponse.json(visible);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Issue>;
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const maxPos = issues.reduce((m, i) => Math.max(m, i.position), -1);
  const next: Issue = {
    id: crypto.randomUUID(),
    name: body.name,
    color: body.color ?? '#94a3b8',
    deadline: body.deadline ?? null,
    sort_mode: (body.sort_mode === 'sequential' ? 'sequential' : 'checklist'),
    position: maxPos + 1,
    notion_issue_id: body.notion_issue_id ?? null,
    created_at: new Date().toISOString(),
    is_deleted: false,
  };
  issues.push(next);
  return NextResponse.json(next, { status: 201 });
}

// Helpers exposed for sibling routes (kept on the route module to share state in dev)
export const __issuesRef = () => issues;
export const __setIssues = (next: Issue[]) => { issues = next; };
```

- [ ] **Step 2: Smoke test**

Start dev server: `npm run dev`. In a second terminal:

```bash
curl -s http://localhost:3000/api/issues | head -c 400
curl -s -X POST http://localhost:3000/api/issues \
  -H 'Content-Type: application/json' \
  -d '{"name":"임시 ISSUE"}' | head -c 200
```

Expected: first call returns 2 ISSUEs from mock; second returns the newly created ISSUE with a fresh uuid.

---

### Task 5: `/api/issues/[id]` — get / patch / delete + cascade

**Files:**
- Create: `src/app/api/issues/[id]/route.ts`

- [ ] **Step 1: Implement route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Issue } from '@/lib/types';
import { __issuesRef, __setIssues } from '../route';
// We also need to mutate tasks on cascade. The tasks mock module exposes its array similarly:
import { __tasksRef } from '@/app/api/tasks/route';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const issue = __issuesRef().find(i => i.id === id && !i.is_deleted);
  if (!issue) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(issue);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const patch = await req.json() as Partial<Issue>;
  const issues = __issuesRef();
  const idx = issues.findIndex(i => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const allowed: (keyof Issue)[] = ['name','color','deadline','sort_mode','position','notion_issue_id'];
  for (const key of allowed) {
    if (key in patch) (issues[idx] as Record<keyof Issue, unknown>)[key] = patch[key]!;
  }
  return NextResponse.json(issues[idx]);
}

// DELETE supports a query param ?cascade=delete | detach (default detach)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cascade = new URL(req.url).searchParams.get('cascade') ?? 'detach';
  const issues = __issuesRef();
  const idx = issues.findIndex(i => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const tasks = __tasksRef();
  for (const t of tasks) {
    if (t.issue_id === id) {
      if (cascade === 'delete') {
        t.is_deleted = true;
        // also cascade to sub-TASKs of these tasks
        for (const child of tasks) {
          if (child.parent_task_id === t.id) child.is_deleted = true;
        }
      } else {
        t.issue_id = null;
      }
    }
  }
  issues[idx].is_deleted = true;
  return NextResponse.json({ ok: true, cascade });
}
```

- [ ] **Step 2: Expose `__tasksRef` from `/api/tasks/route.ts`**

This is a small change to `src/app/api/tasks/route.ts` so cascade works against the same in-memory array. After the existing `let tasks: Task[] = [...MOCK_TASKS];` line, add:

```ts
export const __tasksRef = () => tasks;
```

If `tasks` isn't already declared as a module-level mutable (the existing route may use a different pattern), wrap whatever array it uses. The contract is: a function that returns the live array.

- [ ] **Step 3: Smoke test**

```bash
curl -s -X PATCH http://localhost:3000/api/issues/10000000-0000-0000-0000-000000000001 \
  -H 'Content-Type: application/json' -d '{"name":"리네임"}'
curl -s -X DELETE 'http://localhost:3000/api/issues/<id-of-the-temp-issue-from-task-4>?cascade=detach'
```

Expected: PATCH returns updated ISSUE; DELETE returns `{ok:true,cascade:"detach"}`.

---

### Task 6: Update `/api/tasks` and `/api/tasks/[id]` to handle new fields

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Allow filtering and ensure new fields are returned**

In the GET handler of `src/app/api/tasks/route.ts`, return tasks as before (the new fields are now in the model, so they flow naturally). Add three optional query params:

- `?issue_id=<id>` → filter to one ISSUE (used by `/issues/[id]` page)
- `?parent_task_id=<id>` → filter to children of one TASK
- `?independent=true` → only `issue_id IS NULL AND parent_task_id IS NULL`

```ts
// inside GET, after applying existing priority/source filters
const issueId = searchParams.get('issue_id');
const parentId = searchParams.get('parent_task_id');
const independent = searchParams.get('independent') === 'true';
let result = tasks.filter(t => !t.is_deleted);
if (issueId) result = result.filter(t => t.issue_id === issueId);
if (parentId) result = result.filter(t => t.parent_task_id === parentId);
if (independent) result = result.filter(t => t.issue_id === null && t.parent_task_id === null);
// keep the existing priority/source/status filtering chain after this
```

- [ ] **Step 2: PATCH supports new fields + completion guard**

In `src/app/api/tasks/[id]/route.ts` PATCH handler, allow setting `issue_id`, `parent_task_id`, `sort_mode`, `position`. **Reject `status: '완료'` if any sub-TASK is incomplete**:

```ts
const allowed: (keyof Task)[] = [
  'title','description','priority','status','requester','requested_at',
  'deadline','started_at','completed_at','actual_duration','is_duration_manual',
  'delegate_to','follow_up_note',
  'issue_id','parent_task_id','sort_mode','position',  // new
];
// Hard rule: completion blocked if any sub-TASK incomplete
if (patch.status === '완료') {
  const childrenIncomplete = tasks.some(
    c => !c.is_deleted && c.parent_task_id === id && c.status !== '완료'
  );
  if (childrenIncomplete) {
    return NextResponse.json(
      { error: 'sub-TASK 미완료', code: 'INCOMPLETE_CHILDREN' },
      { status: 409 },
    );
  }
}
// Reject dual parent
if (patch.issue_id != null && patch.parent_task_id != null) {
  return NextResponse.json({ error: 'cannot have both issue_id and parent_task_id' }, { status: 400 });
}
// apply allowed keys as before
```

- [ ] **Step 3: Type check + commit Phase 2**

```bash
npm run build  # expect clean
git add src/app/api/issues src/app/api/tasks/route.ts src/app/api/tasks/[id]/route.ts
git commit -m "feat(api): add /api/issues CRUD and hierarchy fields on tasks

Issues route exposes list/create/get/patch/delete with cascade=detach
(default) or cascade=delete on DELETE. Tasks PATCH now accepts the
four new fields and rejects completion if any sub-TASK is unfinished
(409 INCOMPLETE_CHILDREN). Tasks GET supports issue_id, parent_task_id,
and independent=true query params for tree assembly."
```

---

## Phase 3 — Inbox hierarchy display (no drag yet)

### Task 7: Hierarchy utilities

**Files:**
- Create: `src/lib/hierarchy.ts`
- Create: `src/lib/lock-state.ts`

- [ ] **Step 1: `src/lib/hierarchy.ts`**

```ts
import { Issue, Task } from './types';

export interface IssueNode {
  issue: Issue;
  tasks: TaskNode[];
}
export interface TaskNode {
  task: Task;
  children: TaskNode[];
}

export function buildTree(issues: Issue[], tasks: Task[]): {
  issues: IssueNode[];
  independents: TaskNode[];
} {
  const live = tasks.filter(t => !t.is_deleted);
  const byParent = new Map<string, Task[]>();
  for (const t of live) {
    if (t.parent_task_id) {
      const arr = byParent.get(t.parent_task_id) ?? [];
      arr.push(t);
      byParent.set(t.parent_task_id, arr);
    }
  }
  const sortPos = (a: Task, b: Task) => a.position - b.position;
  const buildNode = (t: Task): TaskNode => ({
    task: t,
    children: (byParent.get(t.id) ?? []).sort(sortPos).map(buildNode),
  });

  const tasksByIssue = new Map<string, Task[]>();
  const independents: TaskNode[] = [];
  for (const t of live) {
    if (t.parent_task_id) continue; // sub-TASK handled via parent
    if (t.issue_id) {
      const arr = tasksByIssue.get(t.issue_id) ?? [];
      arr.push(t);
      tasksByIssue.set(t.issue_id, arr);
    } else {
      independents.push(buildNode(t));
    }
  }

  const issueNodes: IssueNode[] = issues
    .filter(i => !i.is_deleted)
    .sort((a, b) => a.position - b.position)
    .map(issue => ({
      issue,
      tasks: (tasksByIssue.get(issue.id) ?? []).sort(sortPos).map(buildNode),
    }));

  return { issues: issueNodes, independents };
}

// Recursive: TASK shown if itself incomplete OR any descendant incomplete
export function hasIncomplete(node: TaskNode): boolean {
  if (node.task.status !== '완료') return true;
  return node.children.some(hasIncomplete);
}

export function filterIncomplete(tree: ReturnType<typeof buildTree>) {
  const issueNodesPruned = tree.issues
    .map(i => ({ ...i, tasks: i.tasks.filter(hasIncomplete) }))
    .filter(i => i.tasks.length > 0);
  const indPruned = tree.independents.filter(hasIncomplete);
  return { issues: issueNodesPruned, independents: indPruned };
}
```

- [ ] **Step 2: `src/lib/lock-state.ts`**

```ts
import { TaskNode } from './hierarchy';

// In sequential mode: every TASK strictly after the first incomplete sibling is "locked"
// (visually only — soft rule). The first incomplete sibling itself is NOT locked.
export function lockedSiblings(siblings: TaskNode[], sortMode: 'checklist' | 'sequential'): Set<string> {
  if (sortMode !== 'sequential') return new Set();
  const locked = new Set<string>();
  let pastFirstIncomplete = false;
  for (const node of siblings) {
    if (pastFirstIncomplete) locked.add(node.task.id);
    if (node.task.status !== '완료') pastFirstIncomplete = true;
  }
  return locked;
}

// Hard rule: parent TASK completion blocked if any direct sub-TASK incomplete
export function completionBlocked(node: TaskNode): boolean {
  return node.children.some(c => c.task.status !== '완료');
}
```

- [ ] **Step 3: Type check**

```bash
npm run build
```

(No commit yet — these are wired up in Task 8.)

---

### Task 8: `IssueRow` and inbox tree component

**Files:**
- Create: `src/components/issues/issue-row.tsx`
- Create: `src/components/inbox/inbox-tree.tsx`
- Create: `src/lib/use-tree-collapsed.ts`

- [ ] **Step 1: `src/lib/use-tree-collapsed.ts`**

```ts
'use client';
import { useCallback, useState, useEffect } from 'react';

const KEY = (kind: 'issue' | 'task', id: string) => `wid:collapsed:${kind}:${id}`;

export function useCollapsed(kind: 'issue' | 'task', id: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem(KEY(kind, id)) : null;
    if (v != null) setCollapsed(v === '1');
  }, [kind, id]);
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY(kind, id), next ? '1' : '0'); } catch {}
      return next;
    });
  }, [kind, id]);
  return { collapsed, toggle };
}
```

- [ ] **Step 2: `src/components/issues/issue-row.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Lock } from 'lucide-react';
import { Issue, Task } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Props {
  issue: Issue;
  taskCount: number;
  doneCount: number;
  subCount: number;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

export function IssueRow({ issue, taskCount, doneCount, subCount, children, onEdit, onDelete }: Props) {
  const { collapsed, toggle } = useCollapsed('issue', issue.id, false);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'ISSUE 펼치기' : 'ISSUE 접기'}
          className="p-1 -m-1 rounded hover:bg-accent/50 transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
        </button>
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: issue.color }} aria-hidden />
        <Link
          href={`/issues/${issue.id}`}
          className="font-semibold text-sm truncate hover:underline underline-offset-2"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {issue.name}
        </Link>
        {issue.deadline && (
          <span className="text-xs text-muted-foreground">⏰ {formatDate(issue.deadline, 'M월 d일')}</span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] px-1.5 h-5 rounded-full border',
            issue.sort_mode === 'sequential' ? 'border-amber-300 text-amber-700 dark:text-amber-400' : 'border-border text-muted-foreground'
          )}
          title={issue.sort_mode === 'sequential' ? '순차 워크플로우 (이전 task가 끝나야 다음 task 잠금 해제)' : '체크리스트 (순서 무관)'}
        >
          {issue.sort_mode === 'sequential' ? <Lock className="h-2.5 w-2.5" /> : null}
          {issue.sort_mode === 'sequential' ? '순차' : '체크리스트'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          TASK {doneCount}/{taskCount}{subCount > 0 ? ` · sub ${subCount}` : ''}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent" aria-label="ISSUE 메뉴">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />편집</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!collapsed && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/inbox/inbox-tree.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { Issue, Task } from '@/lib/types';
import { buildTree, filterIncomplete, TaskNode } from '@/lib/hierarchy';
import { lockedSiblings, completionBlocked } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { IssueRow } from '@/components/issues/issue-row';
import { useCollapsed } from '@/lib/use-tree-collapsed';

interface Props {
  issues: Issue[];
  tasks: Task[];
  showCompleted: boolean;
  taskHandlers: {
    onTimerChange: () => void;
    onStatusChange: (id: string, status: string) => void;
    onComplete: (id: string) => void;
    onDelete: (id: string) => void;
    onSelect: (id: string) => void;
  };
  onEditIssue: (i: Issue) => void;
  onDeleteIssue: (i: Issue) => void;
}

function TaskBranch({
  node, depth, lockedIds, sortMode, ...handlers
}: {
  node: TaskNode;
  depth: number;
  lockedIds: Set<string>;
  sortMode: 'checklist' | 'sequential';
} & Props['taskHandlers']) {
  const { collapsed, toggle } = useCollapsed('task', node.task.id, false);
  const blocked = completionBlocked(node);
  const locked = lockedIds.has(node.task.id);
  const childLocked = lockedSiblings(node.children, node.task.sort_mode);

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-start gap-1">
        {node.children.length > 0 && (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? '하위 펼치기' : '하위 접기'}
            className="mt-3 p-1 -m-1 rounded text-muted-foreground hover:bg-accent/50"
          >
            <span className={`inline-block transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
          </button>
        )}
        <div className={`flex-1 ${locked ? 'opacity-60' : ''}`}>
          <TaskCard
            task={node.task}
            onTimerChange={handlers.onTimerChange}
            onStatusChange={blocked ? undefined : handlers.onStatusChange}
            onComplete={blocked ? undefined : handlers.onComplete}
            onDelete={handlers.onDelete}
            onSelect={handlers.onSelect}
          />
          {blocked && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400 ml-3 mt-1">
              🔒 sub-TASK {node.children.filter(c => c.task.status !== '완료').length}개 미완료 — 완료할 수 없음
            </div>
          )}
          {locked && (
            <div className="text-[10px] text-muted-foreground ml-3 mt-1">
              🔒 이전 task 대기 중
            </div>
          )}
        </div>
      </div>
      {!collapsed && node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map(child => (
            <TaskBranch
              key={child.task.id}
              node={child}
              depth={depth + 1}
              lockedIds={childLocked}
              sortMode={node.task.sort_mode}
              {...handlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InboxTree({ issues, tasks, showCompleted, taskHandlers, onEditIssue, onDeleteIssue }: Props) {
  const tree = useMemo(() => {
    const built = buildTree(issues, tasks);
    return showCompleted ? built : filterIncomplete(built);
  }, [issues, tasks, showCompleted]);

  return (
    <div className="space-y-3">
      {tree.issues.map(({ issue, tasks: nodes }) => {
        const total = nodes.length;
        const done = nodes.filter(n => n.task.status === '완료').length;
        const subCount = nodes.reduce((s, n) => s + n.children.length, 0);
        const locked = lockedSiblings(nodes, issue.sort_mode);
        return (
          <IssueRow
            key={issue.id}
            issue={issue}
            taskCount={total}
            doneCount={done}
            subCount={subCount}
            onEdit={() => onEditIssue(issue)}
            onDelete={() => onDeleteIssue(issue)}
          >
            {nodes.map(n => (
              <TaskBranch
                key={n.task.id}
                node={n}
                depth={0}
                lockedIds={locked}
                sortMode={issue.sort_mode}
                {...taskHandlers}
              />
            ))}
          </IssueRow>
        );
      })}
      {tree.independents.length > 0 && (
        <div className="space-y-2">
          {tree.independents.map(n => (
            <TaskBranch
              key={n.task.id}
              node={n}
              depth={0}
              lockedIds={new Set()}
              sortMode="checklist"
              {...taskHandlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npm run build
```

Expected: builds clean.

---

### Task 9: Wire up inbox page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace flat list rendering with `<InboxTree />`**

In `src/app/page.tsx`:

1. Add state for issues + showCompleted toggle (default false):

```tsx
const [issues, setIssues] = useState<Issue[]>([]);
const [showCompleted, setShowCompleted] = useState(false);
```

2. Fetch both in parallel inside `fetchTasks`:

```tsx
const fetchAll = useCallback(async () => {
  setLoading(true);
  try {
    const [taskData, issueData] = await Promise.all([
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Issue[]>('/api/issues'),
    ]);
    setTasks(taskData);
    setIssues(issueData);
  } finally { setLoading(false); }
}, []);
useEffect(() => { fetchAll(); }, [fetchAll]);
```

(Replace the existing `fetchTasks` accordingly. Keep its `task-created` event listener but call `fetchAll`.)

3. Replace the "Main list" `<div>` block with:

```tsx
<div className="flex items-center gap-3 mb-3">
  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
    {showCompleted ? '전체' : '미완료'} <span className="text-primary ml-1">({...counted...})</span>
  </h3>
  <Button variant="ghost" size="sm" onClick={() => setShowCompleted(v => !v)}>
    {showCompleted ? '미완료만 보기' : '완료된 것도 보기'}
  </Button>
</div>
<InboxTree
  issues={issues}
  tasks={tasks}
  showCompleted={showCompleted}
  taskHandlers={{
    onTimerChange: fetchAll,
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: id => setDeleteId(id),
    onSelect: setSelectedTaskId,
  }}
  onEditIssue={(i) => setEditingIssue(i)}
  onDeleteIssue={(i) => setDeleteIssue(i)}
/>
```

(Remove the now-redundant `mainFiltered` rendering block. Keep the `customViews` block below — it still works on flat tasks for backwards compatibility.)

4. Add stub state for ISSUE editing/deletion (they'll be wired in Phase 4):

```tsx
const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
const [deleteIssue, setDeleteIssue] = useState<Issue | null>(null);
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev` (already running from earlier). Open http://localhost:3000

Expected:
- ISSUE row "회원가입 플로우 개편" appears with its 1 TASK + 2 sub-TASKs (the seed mock data from Task 2)
- Other ISSUE "결제 모듈 리뷰" appears empty (we didn't seed tasks for it — that's fine)
- Independent tasks still appear below
- Toggle "완료된 것도 보기" reveals/hides finished items
- ▶/▼ on ISSUE row collapses/expands

- [ ] **Step 3: Commit Phase 3**

```bash
npm run lint
git add src/lib/hierarchy.ts src/lib/lock-state.ts src/lib/use-tree-collapsed.ts src/components/issues/issue-row.tsx src/components/inbox/inbox-tree.tsx src/app/page.tsx
git commit -m "feat(inbox): render ISSUE→TASK→sub-TASK tree with incomplete-only default

Inbox now groups tasks under their ISSUE with collapsible rows.
Sub-tasks render indented under their parent. The default filter
hides completed items and bubbles 'has-incomplete' upward so a
finished TASK with an unfinished sub-TASK still surfaces (dimmed).
Toggle in the header switches to full view including completed."
```

---

## Phase 4 — ISSUE create / edit / delete

### Task 10: `IssueForm` component

**Files:**
- Create: `src/components/issues/issue-form.tsx`

- [ ] **Step 1: Implement form**

```tsx
'use client';
import { useState } from 'react';
import { Issue, SortMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';

const PALETTE = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#94a3b8'];

interface Props {
  initial?: Issue;
  onSave: (issue: Issue) => void;
  onCancel: () => void;
}
export function IssueForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [mode, setMode] = useState<SortMode>(initial?.sort_mode ?? 'checklist');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = { name: name.trim(), color, deadline: deadline || null, sort_mode: mode };
      const result = initial
        ? await apiFetch<Issue>(`/api/issues/${initial.id}`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
          })
        : await apiFetch<Issue>('/api/issues', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
          });
      onSave(result);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-3 rounded-xl border border-border/60 bg-card">
      <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ISSUE 이름" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">색상</span>
        {PALETTE.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full ring-offset-2 ${c === color ? 'ring-2 ring-foreground' : ''}`}
            style={{ backgroundColor: c }} aria-label={`색상 ${c}`} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">마감일</span>
        <Input type="date" value={deadline ?? ''} onChange={e => setDeadline(e.target.value)} className="max-w-[180px]" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">정렬 모드</span>
        <Button type="button" size="sm" variant={mode === 'checklist' ? 'default' : 'outline'} onClick={() => setMode('checklist')}>체크리스트</Button>
        <Button type="button" size="sm" variant={mode === 'sequential' ? 'default' : 'outline'} onClick={() => setMode('sequential')}>순차</Button>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={!name.trim() || busy}>{initial ? '저장' : '생성'}</Button>
      </div>
    </form>
  );
}
```

---

### Task 11: `IssueDeleteDialog` + wire `+ 새 ISSUE` button

**Files:**
- Create: `src/components/issues/issue-delete-dialog.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `IssueDeleteDialog`**

```tsx
'use client';
import { useState } from 'react';
import { Issue } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface Props {
  issue: Issue | null;
  taskCount: number;
  onClose: () => void;
  onDeleted: () => void;
}
export function IssueDeleteDialog({ issue, taskCount, onClose, onDeleted }: Props) {
  const [mode, setMode] = useState<'detach'|'delete'>('detach');
  const [busy, setBusy] = useState(false);
  if (!issue) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/issues/${issue.id}?cascade=${mode}`, { method: 'DELETE' });
      onDeleted();
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!issue} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ISSUE 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">"{issue.name}"의 자식 TASK <strong>{taskCount}개</strong>를 어떻게 처리할까요?</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="cascade" checked={mode === 'detach'} onChange={() => setMode('detach')} />
            독립 TASK로 분리해서 보존
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="cascade" checked={mode === 'delete'} onChange={() => setMode('delete')} />
            함께 휴지통으로 이동
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>삭제</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into inbox page**

In `src/app/page.tsx`:

1. Add a `+ 새 ISSUE` button near the existing "정렬" select. When clicked, open an inline `<IssueForm />` above `<InboxTree />`.

```tsx
const [addingIssue, setAddingIssue] = useState(false);
// near the filter row:
<Button size="sm" variant="outline" onClick={() => setAddingIssue(true)}>+ 새 ISSUE</Button>
// before <InboxTree />:
{addingIssue && (
  <IssueForm
    onSave={(i) => { setIssues(prev => [...prev, i]); setAddingIssue(false); }}
    onCancel={() => setAddingIssue(false)}
  />
)}
{editingIssue && (
  <IssueForm
    initial={editingIssue}
    onSave={(i) => { setIssues(prev => prev.map(x => x.id === i.id ? i : x)); setEditingIssue(null); }}
    onCancel={() => setEditingIssue(null)}
  />
)}
<IssueDeleteDialog
  issue={deleteIssue}
  taskCount={tasks.filter(t => t.issue_id === deleteIssue?.id && !t.is_deleted).length}
  onClose={() => setDeleteIssue(null)}
  onDeleted={fetchAll}
/>
```

- [ ] **Step 3: Verify in browser**

- Click `+ 새 ISSUE` → form appears → enter name "Test ISSUE", pick orange, sequential → 생성 → it appears in the list
- Click ⋮ on existing ISSUE → 편집 → form appears with current values → 저장 → name updates inline
- Click ⋮ → 삭제 → dialog with two radio options → pick 분리 → tasks become independent (visible at bottom of inbox)

- [ ] **Step 4: Commit Phase 4**

```bash
npm run build && npm run lint
git add src/components/issues/issue-form.tsx src/components/issues/issue-delete-dialog.tsx src/app/page.tsx
git commit -m "feat(issues): create, edit, delete ISSUE with cascade options

Adds + 새 ISSUE button (inline form), ⋮ menu edit/delete on each
ISSUE row, and a delete dialog that asks how to handle child tasks
(detach to independent or trash together)."
```

---

## Phase 5 — TASK ↔ ISSUE link / unlink

### Task 12: `IssuePicker` modal

**Files:**
- Create: `src/components/issues/issue-picker.tsx`

- [ ] **Step 1: Implement picker**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Issue } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (issueId: string) => void; // selected existing
  onCreate: (name: string) => void;  // create + attach
}
export function IssuePicker({ open, onClose, onPick, onCreate }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    apiFetch<Issue[]>('/api/issues').then(setIssues).catch(() => {});
  }, [open]);
  const filtered = issues.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>ISSUE 선택</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="검색하거나 새 ISSUE 이름 입력" value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-72 overflow-y-auto space-y-1 mt-2">
          {filtered.map(i => (
            <button key={i.id} type="button" onClick={() => { onPick(i.id); onClose(); }}
              className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
              <span className="text-sm">{i.name}</span>
            </button>
          ))}
          {q.trim() && !filtered.some(i => i.name === q.trim()) && (
            <Button variant="outline" className="w-full mt-2" onClick={() => { onCreate(q.trim()); onClose(); }}>
              + "{q.trim()}" ISSUE 새로 만들기
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task 13: TaskDetailPanel — ISSUE field + unlink + width handle

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`
- Create: `src/lib/use-panel-width.ts`

- [ ] **Step 1: `src/lib/use-panel-width.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';
const KEY = 'wid:task-panel-width';
const DEFAULT = 560;

export function usePanelWidth() {
  const [w, setW] = useState(DEFAULT);
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (v) setW(Math.max(360, Math.min(900, Number(v) || DEFAULT)));
  }, []);
  const persist = (next: number) => {
    const clamped = Math.max(360, Math.min(900, next));
    setW(clamped);
    try { localStorage.setItem(KEY, String(clamped)); } catch {}
  };
  return { width: w, setWidth: persist };
}
```

- [ ] **Step 2: TaskDetailPanel changes**

In `src/components/tasks/task-detail-panel.tsx`:

1. Read width via `usePanelWidth` and apply as inline style on the Sheet content wrapper (replace any hardcoded width class).
2. Add a thin draggable handle on the panel's left edge that updates width on `pointermove`.
3. Add an "ISSUE" form section that shows the current ISSUE name (if any) with an `× 분리` button, or `+ ISSUE 연결` button if independent. Connect `IssuePicker`:

```tsx
import { IssuePicker } from '@/components/issues/issue-picker';
// ...
const [pickerOpen, setPickerOpen] = useState(false);
const attachToIssue = async (issueId: string) => {
  await apiFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ issue_id: issueId, parent_task_id: null }),
  });
  onTaskUpdated();
};
const createAndAttach = async (name: string) => {
  const issue = await apiFetch<Issue>('/api/issues', {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }),
  });
  await attachToIssue(issue.id);
};
const unlink = async () => {
  await apiFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ issue_id: null }),
  });
  onTaskUpdated();
};
```

JSX block (insert near existing fields like deadline/requester):

```tsx
<div className="space-y-1">
  <span className="text-xs text-muted-foreground">ISSUE</span>
  {currentIssue ? (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/30">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentIssue.color }} />
      <span className="text-sm flex-1 truncate">{currentIssue.name}</span>
      <Button size="sm" variant="ghost" onClick={unlink}>× 분리</Button>
    </div>
  ) : (
    <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>+ ISSUE 연결</Button>
  )}
</div>
<IssuePicker
  open={pickerOpen}
  onClose={() => setPickerOpen(false)}
  onPick={attachToIssue}
  onCreate={createAndAttach}
/>
```

(Engineer: `currentIssue` is derived by looking up `task.issue_id` against the `issues` list. The panel should fetch the issue list once or accept it as a prop. Simplest: fetch on mount when the panel opens. Cache for the session.)

- [ ] **Step 3: Verify in browser**

- Open an independent task → panel shows `+ ISSUE 연결` → click → picker → choose "회원가입 플로우 개편" → close panel → reopen → ISSUE shown
- Click `× 분리` → returns to independent
- Drag the left edge of the panel → width changes and persists across reload

- [ ] **Step 4: Commit Phase 5**

```bash
npm run build && npm run lint
git add src/components/issues/issue-picker.tsx src/components/tasks/task-detail-panel.tsx src/lib/use-panel-width.ts
git commit -m "feat(panel): ISSUE link/unlink in TASK detail + resizable width

TaskDetailPanel gains an ISSUE field with picker (search existing or
create new) and an unlink action. Panel width is now drag-resizable
with localStorage persistence; default raised to 560px."
```

---

## Phase 6 — `/issues/[id]` page

### Task 14: ISSUE management page

**Files:**
- Create: `src/app/issues/[id]/page.tsx`
- Create: `src/app/api/issues/[id]/tasks/route.ts`

- [ ] **Step 1: Tasks-of-issue API**

```ts
// src/app/api/issues/[id]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { __tasksRef } from '@/app/api/tasks/route';

interface Params { params: Promise<{ id: string }> }
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const tasks = __tasksRef().filter(t => !t.is_deleted && (
    t.issue_id === id ||
    // sub-TASKs whose parent is in this issue
    (t.parent_task_id && __tasksRef().some(p => p.id === t.parent_task_id && p.issue_id === id))
  ));
  return NextResponse.json(tasks);
}
```

- [ ] **Step 2: Page**

```tsx
'use client';
import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { Issue, Task } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { buildTree, filterIncomplete } from '@/lib/hierarchy';
import { lockedSiblings, completionBlocked } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { Button } from '@/components/ui/button';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchAll = async () => {
    const [i, t] = await Promise.all([
      apiFetch<Issue>(`/api/issues/${id}`),
      apiFetch<Task[]>(`/api/issues/${id}/tasks`),
    ]);
    setIssue(i); setTasks(t);
  };
  useEffect(() => { fetchAll(); }, [id]);

  const tree = useMemo(() => {
    if (!issue) return null;
    const built = buildTree([issue], tasks);
    return showCompleted ? built : filterIncomplete(built);
  }, [issue, tasks, showCompleted]);

  if (!issue) return <div className="p-6 text-muted-foreground">로딩…</div>;

  const node = tree?.issues[0];
  const total = tasks.filter(t => !t.parent_task_id).length;
  const done = tasks.filter(t => !t.parent_task_id && t.status === '완료').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-4">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← 인박스</Link>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: issue.color }} />
          <h1 className="text-xl font-semibold">{issue.name}</h1>
          {issue.deadline && <span className="text-sm text-muted-foreground">⏰ {issue.deadline}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full border">
            {issue.sort_mode === 'sequential' ? '순차' : '체크리스트'}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground">{done}/{total} ({pct}%)</div>
        <Button size="sm" variant="ghost" onClick={() => setShowCompleted(v => !v)}>
          {showCompleted ? '미완료만 보기' : '완료된 것도 보기'}
        </Button>
        <div className="space-y-2">
          {node?.tasks.map(n => (
            <div key={n.task.id} className="space-y-2">
              <TaskCard
                task={n.task}
                onComplete={completionBlocked(n) ? undefined : () => {/* todo: complete via PATCH */}}
                onSelect={(tid) => setSelectedTaskId(tid)}
              />
              {n.children.map(c => (
                <div key={c.task.id} className="ml-4">
                  <TaskCard task={c.task} onSelect={(tid) => setSelectedTaskId(tid)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchAll}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

- Click ISSUE name in inbox → navigate to `/issues/[id]`
- Page shows ISSUE header, progress bar, all TASKs + sub-TASKs (incomplete only by default)
- Toggle reveals completed
- Click any TASK → right panel opens (existing TaskDetailPanel)

- [ ] **Step 4: Commit Phase 6**

```bash
npm run build && npm run lint
git add src/app/issues src/app/api/issues/\[id\]/tasks
git commit -m "feat(issues): wide /issues/[id] management page

ISSUE detail page with header (name/color/deadline/mode),
progress bar, full TASK + sub-TASK tree, and incomplete/all toggle.
Right side reuses TaskDetailPanel for per-task editing."
```

---

## Phase 7 — Hard completion rule (already enforced server-side; UI hint)

### Task 15: Surface completion-blocked state in `TaskCard`

**Files:**
- Modify: `src/components/tasks/task-card.tsx`

- [ ] **Step 1: Disable completion + show tooltip**

If `onComplete` prop is undefined (already passed undefined by `InboxTree` when blocked), the existing button click does nothing. Add a `data-blocked` attribute and disable affordance:

```tsx
// In the completion toggle button:
const blocked = !onComplete;
<button
  type="button"
  disabled={blocked}
  className={cn(
    'flex-shrink-0 -m-1.5 p-1.5 rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    blocked && 'cursor-not-allowed opacity-50'
  )}
  title={blocked ? 'sub-TASK가 모두 완료되어야 완료할 수 있습니다' : (isCompleted ? '완료 취소' : '완료 처리')}
  aria-label={blocked ? '완료 불가 (sub-TASK 미완료)' : (isCompleted ? '완료 취소' : '완료 처리')}
  onClick={(e) => { e.stopPropagation(); onComplete?.(task.id); }}
>
```

Also: handle the 409 from PATCH gracefully in `handleStatusChange` of `src/app/page.tsx`. Wrap the `apiFetch` call to detect status 409 and show a toast/alert via `sonner` (already in deps):

```tsx
import { toast } from 'sonner';
// inside handleStatusChange catch path:
if (err.status === 409 && err.code === 'INCOMPLETE_CHILDREN') {
  toast.error('sub-TASK가 모두 완료되어야 합니다.');
}
```

(Engineer: adapt to whatever shape `apiFetch` errors are. If it currently swallows errors, parse `response.json()` from the failed response and check `code`.)

- [ ] **Step 2: Verify**

- Find a TASK with incomplete sub-TASKs → its complete checkbox is dimmed and disabled
- Hover → tooltip "sub-TASK가 모두 완료되어야..."
- Complete all sub-TASKs → parent's checkbox enables

- [ ] **Step 3: Commit Phase 7**

```bash
npm run build && npm run lint
git add src/components/tasks/task-card.tsx src/app/page.tsx
git commit -m "feat(completion): block parent TASK completion until sub-TASKs done

Hard rule: complete checkbox on a TASK is disabled (with tooltip)
when any direct sub-TASK is incomplete. Server PATCH already
returns 409 INCOMPLETE_CHILDREN; client now surfaces a toast."
```

---

## Phase 8 — Drag-and-drop

### Task 16: Install `@dnd-kit`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Sanity build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @dnd-kit for hierarchy drag-and-drop"
```

---

### Task 17: Sortable within ISSUE / parent TASK

**Files:**
- Modify: `src/components/inbox/inbox-tree.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Wrap each ISSUE's task list in `SortableContext`**

```tsx
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

Wrap top-level rendering of each ISSUE's tasks and the independents list with `SortableContext`. Each `<TaskBranch>` becomes a sortable item via `useSortable({ id: node.task.id })`.

- [ ] **Step 2: Reposition handler in inbox page**

```tsx
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  // simple within-group: assume same parent (reparent comes in Task 18)
  await apiFetch(`/api/tasks/reorder`, { /* ... or compute new positions client-side and PATCH */ });
  fetchAll();
};
```

(Engineer: the simplest implementation patches each affected sibling's `position` via parallel `PATCH /api/tasks/[id]` calls. Decide based on the existing `apiFetch` ergonomics.)

- [ ] **Step 3: Verify**

Drag a TASK within an ISSUE up or down → order persists across refresh.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(dnd): sort siblings via @dnd-kit"
```

---

### Task 18: Reparent across ISSUEs + unlink + drag-merge

**Files:**
- Modify: `src/components/inbox/inbox-tree.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add drop targets**

- Each ISSUE row body becomes a `useDroppable({ id: 'issue:'+issue.id })`
- A "free area" droppable at the bottom for unlink: `useDroppable({ id: 'unlinked' })`
- TASK rows additionally accept drops from other independent TASKs to trigger merge

- [ ] **Step 2: Drag-end branching**

```tsx
const handleDragEnd = async (e: DragEndEvent) => {
  const dragged = String(e.active.id);
  const over = e.over ? String(e.over.id) : null;
  if (!over) return;

  if (over.startsWith('issue:')) {
    const issueId = over.slice(6);
    await apiFetch(`/api/tasks/${dragged}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ issue_id: issueId, parent_task_id: null }),
    });
  } else if (over === 'unlinked') {
    await apiFetch(`/api/tasks/${dragged}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ issue_id: null, parent_task_id: null }),
    });
  } else if (over.startsWith('merge:')) {
    const otherId = over.slice(6);
    // open inline merge prompt with task ids dragged + otherId — see Task 18.3
    setMergeRequest({ aId: dragged, bId: otherId });
  } else {
    // reorder within same parent — handled by SortableContext side-effect
  }
  fetchAll();
};
```

- [ ] **Step 3: Merge prompt**

When user drags an independent TASK A onto another independent TASK B, show a small inline prompt asking for the new ISSUE name. On submit:

```ts
const issue = await apiFetch<Issue>('/api/issues', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ name }),
});
await Promise.all([
  apiFetch(`/api/tasks/${aId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ issue_id: issue.id }) }),
  apiFetch(`/api/tasks/${bId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ issue_id: issue.id }) }),
]);
fetchAll();
```

- [ ] **Step 4: Verify (each scenario)**

- Drag independent TASK onto ISSUE row body → it joins that ISSUE
- Drag TASK from inside ISSUE onto "독립 영역" footer → returns to independent
- Drag independent TASK onto another independent TASK → prompt → enter "Test merge" → both move under new ISSUE

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(dnd): reparent, unlink, drag-merge for tasks"
```

---

### Task 19: sub-TASK drag (promote/move)

**Files:**
- Modify: `src/components/inbox/inbox-tree.tsx`

- [ ] **Step 1: Extend drop targets to include other TASKs as `parent:`**

```tsx
// each TaskBranch becomes also a droppable: id = 'parent:' + taskId
// drag-end:
} else if (over.startsWith('parent:')) {
  const newParent = over.slice(7);
  await apiFetch(`/api/tasks/${dragged}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ parent_task_id: newParent, issue_id: null }),
  });
}
```

- [ ] **Step 2: Promote to sibling**

When sub-TASK dropped on ISSUE row body, set `parent_task_id: null` and `issue_id: <that issue>`. When dropped on "독립 영역", both null.

- [ ] **Step 3: Verify**

- Drag sub-TASK onto a different parent TASK → reparents
- Drag sub-TASK onto ISSUE row body (not on a TASK) → becomes a regular TASK in that ISSUE
- Drag sub-TASK onto unlinked area → becomes independent

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(dnd): sub-TASK promote and reparent across TASKs/ISSUEs"
```

---

## Phase 9 — Sequential mode polish

### Task 20: Sort-mode toggle on ISSUE header + visual lock

**Files:**
- Modify: `src/components/issues/issue-row.tsx`
- Modify: `src/app/issues/[id]/page.tsx`

- [ ] **Step 1: Make sort_mode badge clickable**

In `IssueRow`, the existing `순차 / 체크리스트` badge becomes a button that PATCHes `/api/issues/[id]` with `{ sort_mode: 'sequential' | 'checklist' }`, then triggers refetch via a callback prop `onModeChange`. Wire it through `<InboxTree>` props.

- [ ] **Step 2: Lock visual already exists**

`TaskBranch` already renders 🔒 + opacity-60 when `lockedIds` contains the id. After this task lands, the lock chain immediately reflects mode changes.

- [ ] **Step 3: Verify**

- Click "체크리스트" badge → flips to "순차" → sibling TASKs after the first incomplete one show 🔒
- Complete the first incomplete → next one's lock disappears

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(sequential): clickable mode toggle and live lock visual"
```

---

## Phase 10 — Notion sync extension

### Task 21: Map Notion ISSUE relation → Issues + attach

**Files:**
- Modify: `src/app/api/notion/sync/route.ts`

- [ ] **Step 1: Extend sync logic**

Existing route fetches Notion task rows. Modifications:

1. For each row, also read the ISSUE relation property (engineer: confirm exact property name in the user's Notion DB; default assumption `Issue` or `이슈`). Resolve relation IDs to titles using the Notion API in one batch.
2. Maintain a `Map<notionIssueId, Issue>` keyed by `notion_issue_id` from our DB. For each notion ISSUE id: find existing or create new (color rotates from a fixed palette using `notionIssueId.charCodeAt(0)`).
3. When upserting each task, set `task.issue_id = matchedIssue.id`. If the row has no relation: `task.issue_id = null`.

```ts
const PALETTE = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#94a3b8'];

async function ensureIssue(notionIssueId: string, title: string): Promise<Issue> {
  const issues = __issuesRef();
  let existing = issues.find(i => i.notion_issue_id === notionIssueId);
  if (existing) {
    if (existing.name !== title) existing.name = title; // notion is source of truth for name
    return existing;
  }
  const next: Issue = {
    id: crypto.randomUUID(),
    name: title,
    color: PALETTE[Math.abs(notionIssueId.charCodeAt(0)) % PALETTE.length],
    deadline: null,
    sort_mode: 'checklist',
    position: issues.length,
    notion_issue_id: notionIssueId,
    created_at: new Date().toISOString(),
    is_deleted: false,
  };
  issues.push(next);
  return next;
}
```

- [ ] **Step 2: Verify (limited — currently mock)**

The existing route hits Notion when `NOTION_TOKEN`/database id are configured. With mock-only data the sync route may be a no-op. Verify the code paths compile and that any existing manual sync trigger logs the new flow.

- [ ] **Step 3: Commit**

```bash
npm run build && npm run lint
git commit -am "feat(notion): map Notion ISSUE relation to local Issues during sync

Notion remains source of truth: ISSUE name follows Notion changes,
local-only fields (color, deadline, sort_mode, position) are
preserved across syncs. Tasks without an ISSUE relation enter
the inbox as independent TASKs."
```

---

## Phase 11 — Search & filter recursion + final polish

### Task 22: Search auto-expands matched parents

**Files:**
- Modify: `src/components/inbox/inbox-tree.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Pass `searchQuery` into the tree and pre-expand**

When `searchQuery` is non-empty:
- Compute the set of matching task ids (title includes query, case-insensitive)
- Add their parent ids (TASK and ISSUE) to a "force expanded" set
- Pass to `IssueRow` / `TaskBranch` to override their internal collapse state

Implementation outline: extend `useCollapsed` to accept a `forceOpen` boolean.

- [ ] **Step 2: Filter pruning**

If a leaf doesn't match and has no matching descendant, remove from rendered tree. ISSUE without any match removes from list.

- [ ] **Step 3: Verify**

- Type "체크박스" in search → ISSUE auto-expands, matching sub-TASK is highlighted by browser `find` or by the existing TaskFilter behavior
- Clear search → previously-set collapse states return

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(search): recursive match with auto-expand for matched parents"
```

---

## Phase 12 — Verification

### Task 23: Build + lint + smoke

**Files:** _none_

- [ ] **Step 1: Full build + lint**

```bash
npm run build
npm run lint
```

Both must succeed with no errors.

- [ ] **Step 2: Manual smoke checklist (browser)**

Run `npm run dev` and verify each:

- [ ] Inbox shows 2 ISSUEs and independent TASKs from mock
- [ ] ISSUE collapse/expand persists after reload
- [ ] `완료된 것도 보기` toggle reveals/hides finished items
- [ ] Click ISSUE name → /issues/[id] opens with full tree
- [ ] Click TASK → right panel opens
- [ ] Panel ISSUE field — link / unlink / create-new flows work
- [ ] Panel width drag persists across reload
- [ ] `+ 새 ISSUE` flow creates and renders
- [ ] ISSUE delete dialog: detach option moves children to independent; delete option removes them
- [ ] Hard rule: TASK with incomplete sub-TASK has disabled complete checkbox + tooltip
- [ ] Sequential mode: lock icons appear on later siblings, vanish when earlier one completes
- [ ] Drag within ISSUE reorders
- [ ] Drag onto ISSUE row body reparents
- [ ] Drag to "독립 영역" unlinks
- [ ] Drag onto another independent TASK → merge prompt → creates ISSUE
- [ ] Drag sub-TASK onto another TASK reparents under it
- [ ] Search auto-expands matching parents
- [ ] No console errors

- [ ] **Step 3: Commit (if any whitespace/lint fixes)**

```bash
git status -s
# if anything changed:
git commit -am "chore: post-verification cleanup"
```

- [ ] **Step 4: Push to personal GitHub**

```bash
git push origin master
git log -3 --pretty=format:"%h %ae %s"
```

Expected: 3 most recent commits all author `sholivelee@gmail.com`. Origin push succeeds.

---

## Self-review notes (engineer reading this plan)

- **Spec coverage**: every section of `2026-04-25-issue-task-hierarchy-design.md` maps to a phase here. Sections 4 & 5 of spec (inbox UI, ISSUE page) → phases 3 & 6. Section 6 (completion rules) → phase 7. Section 7 (drag-and-drop) → phase 8. Section 9 (Notion sync) → phase 10. Section 11 (phased plan) is reproduced one-to-one.
- **Type consistency**: `Issue` fields and `Task` extensions match throughout. `sort_mode` always typed as `SortMode`. PATCH whitelist matches the type.
- **Out-of-scope items** (cross-ISSUE deps, dependency graph viz, multi-user) are explicitly excluded.
- **Dev-mode caveat**: All routes share state via in-memory module exports (`__issuesRef`, `__tasksRef`). When Supabase is wired up later, replace these with real queries; the migration `002_issue_hierarchy.sql` is already prepared.
- **Korean UI strings** are kept untouched; new buttons/labels are Korean. Variable / function names stay English.
