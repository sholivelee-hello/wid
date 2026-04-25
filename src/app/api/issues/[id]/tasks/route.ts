import { NextRequest, NextResponse } from 'next/server';
import { __tasksRef } from '@/app/api/tasks/route';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const all = __tasksRef();
  const live = all.filter(t => !t.is_deleted);
  const directIds = new Set(
    live.filter(t => t.issue_id === id).map(t => t.id),
  );
  const result = live.filter(t =>
    t.issue_id === id ||
    (t.parent_task_id != null && directIds.has(t.parent_task_id)),
  );
  return NextResponse.json(result);
}
