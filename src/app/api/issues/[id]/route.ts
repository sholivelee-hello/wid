import { NextRequest, NextResponse } from 'next/server';
import { Issue } from '@/lib/types';
import { __issuesRef } from '../route';
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
  const allowed: (keyof Issue)[] = ['name', 'color', 'deadline', 'sort_mode', 'position', 'notion_issue_id'];
  for (const key of allowed) {
    if (key in patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (issues[idx] as any)[key] = (patch as any)[key];
    }
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
    if (t.issue_id === id && !t.is_deleted) {
      if (cascade === 'delete') {
        t.is_deleted = true;
        // also cascade to sub-TASKs
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
