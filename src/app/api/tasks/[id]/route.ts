import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/mock-data';
import { __tasksRef, isValidTaskParent, hasChildTasks } from '@/app/api/tasks/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const task = __tasksRef().find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (isMockMode()) {
    const tasks = __tasksRef();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const current = tasks[idx];

    // Guard: TASK ↔ sub-TASK depth flip rejected. Hierarchy depth is fixed
    // at creation; PATCH may move a task across parents but never flip null↔non-null.
    // Evaluated before DUAL_PARENT so the user gets the more specific reason.
    if ('parent_task_id' in body) {
      const wasSub = current.parent_task_id !== null;
      const willBeSub = body.parent_task_id !== null;
      if (wasSub !== willBeSub) {
        return NextResponse.json(
          { error: 'TASK와 sub-TASK는 서로 변환할 수 없습니다. 계층은 생성 시 결정됩니다.', code: 'DEPTH_FLIP' },
          { status: 400 },
        );
      }
    }

    // Guard: reject dual-parent violation
    const draftIssue = 'issue_id' in body ? body.issue_id : current.issue_id;
    const draftParent = 'parent_task_id' in body ? body.parent_task_id : current.parent_task_id;
    if (draftIssue != null && draftParent != null) {
      return NextResponse.json(
        { error: 'TASK는 ISSUE 소속과 sub-TASK 소속을 동시에 가질 수 없습니다.', code: 'DUAL_PARENT' },
        { status: 400 },
      );
    }

    // Guard: reject completion if any direct sub-TASK is incomplete
    if (body.status === '완료') {
      const childrenIncomplete = tasks.some(
        c => !c.is_deleted && c.parent_task_id === id && c.status !== '완료'
      );
      if (childrenIncomplete) {
        return NextResponse.json(
          { error: 'sub-TASK가 모두 완료되어야 부모 TASK를 완료할 수 있습니다.', code: 'INCOMPLETE_CHILDREN' },
          { status: 409 },
        );
      }
    }

    // Guard: cycle prevention when setting parent_task_id
    if ('parent_task_id' in body && body.parent_task_id) {
      const candidate = body.parent_task_id as string;
      let cursor: string | null = candidate;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === id) {
          return NextResponse.json(
            { error: '순환 참조: 이 TASK의 자손을 부모로 지정할 수 없습니다.', code: 'CYCLE' },
            { status: 400 },
          );
        }
        if (seen.has(cursor)) break; // safety net
        seen.add(cursor);
        const parent = tasks.find(t => t.id === cursor && !t.is_deleted);
        cursor = parent?.parent_task_id ?? null;
      }
    }

    // Guard: enforce 2-level hierarchy (ISSUE > TASK > sub-TASK only)
    if ('parent_task_id' in body && body.parent_task_id) {
      if (!isValidTaskParent(tasks, body.parent_task_id as string)) {
        return NextResponse.json(
          { error: '계층은 ISSUE > TASK > sub-TASK 까지만 허용됩니다.', code: 'MAX_DEPTH' },
          { status: 400 },
        );
      }
      if (hasChildTasks(tasks, id)) {
        return NextResponse.json(
          { error: 'sub-TASK가 있는 TASK는 sub-TASK로 이동할 수 없습니다.', code: 'WOULD_DEEPEN' },
          { status: 400 },
        );
      }
    }

    if (body.status === '완료' && !body.completed_at) {
      body.completed_at = new Date().toISOString();
    }

    // Apply allowed fields (merge onto existing task object)
    const allowedKeys = [
      'title', 'description', 'priority', 'status', 'source',
      'requester', 'requested_at', 'deadline', 'completed_at',
      'notion_task_id',
      'slack_url', 'slack_channel', 'slack_sender',
      'delegate_to', 'follow_up_note',
      'issue_id', 'parent_task_id', 'sort_mode', 'position',
    ];
    for (const key of allowedKeys) {
      if (key in body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tasks[idx] as any)[key] = body[key];
      }
    }

    return NextResponse.json(tasks[idx]);
  }

  const supabase = createServerSupabaseClient();

  if (body.status === '완료' && !body.completed_at) {
    body.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const tasks = __tasksRef();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    tasks[idx].is_deleted = true;
    return NextResponse.json(tasks[idx]);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_deleted: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
