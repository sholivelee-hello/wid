import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// 클라이언트가 PATCH로 바꿀 수 있는 필드 화이트리스트 — id/created_at/is_deleted/
// pending_at(전용 라우트 담당)/출처 식별자 스푸핑을 막는다 (docs/architecture/mock-backend.md).
const ALLOWED_PATCH_FIELDS = [
  'title', 'description', 'status', 'requester', 'requested_at',
  'deadline', 'completed_at', 'delegate_to', 'follow_up_note',
  'issue_id', 'parent_task_id', 'sort_mode', 'position', 'name_locked',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerSupabaseClient();

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  if (update.status === '완료' && !update.completed_at) {
    update.completed_at = new Date().toISOString();
  }

  // 3-level 계층 가드 (docs/architecture/hierarchy.md) — ISSUE > TASK > sub-TASK.
  if ('parent_task_id' in update || 'issue_id' in update) {
    const { data: current, error: curErr } = await supabase
      .from('tasks')
      .select('id, issue_id, parent_task_id')
      .eq('id', id)
      .single();
    if (curErr) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const nextParent =
      'parent_task_id' in update ? update.parent_task_id : current.parent_task_id;
    const nextIssue = 'issue_id' in update ? update.issue_id : current.issue_id;

    if (nextParent && nextIssue) {
      return NextResponse.json({ error: 'DUAL_PARENT' }, { status: 400 });
    }
    if (nextParent) {
      if (nextParent === id) {
        return NextResponse.json({ error: 'CYCLE' }, { status: 400 });
      }
      const { data: parent } = await supabase
        .from('tasks')
        .select('id, parent_task_id, is_deleted')
        .eq('id', nextParent)
        .maybeSingle();
      if (!parent || parent.is_deleted) {
        return NextResponse.json({ error: 'PARENT_NOT_FOUND' }, { status: 400 });
      }
      if (parent.parent_task_id) {
        return NextResponse.json({ error: 'MAX_DEPTH' }, { status: 400 });
      }
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('parent_task_id', id)
        .eq('is_deleted', false);
      if ((count ?? 0) > 0) {
        return NextResponse.json({ error: 'WOULD_DEEPEN' }, { status: 400 });
      }
    }
  }

  if (Object.keys(update).length === 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
