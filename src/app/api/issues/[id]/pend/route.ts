import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ISSUE 통째 보류: issue + 소속 top-level task + 그 sub-task 전부.
// sub-task는 issue_id가 null인 경우가 있어 (AddSubTaskRow가 issue_id: null로
// 생성) parent_task_id in (top-level ids) 2차 업데이트가 필요하다.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data: issue, error } = await supabase
    .from('issues')
    .update({ pending_at: now })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: topTasks, error: listErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('issue_id', id)
    .eq('is_deleted', false);
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const ids = (topTasks ?? []).map((t: { id: string }) => t.id);
  if (ids.length > 0) {
    const { error: e1 } = await supabase
      .from('tasks').update({ pending_at: now }).in('id', ids);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabase
      .from('tasks').update({ pending_at: now })
      .in('parent_task_id', ids).eq('is_deleted', false);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json(issue);
}
