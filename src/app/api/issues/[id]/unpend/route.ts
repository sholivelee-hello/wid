import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ISSUE 통째 복귀 — spec 결정: ISSUE 단위로만 복귀하며, ISSUE 보류 이전에
// 개별 보류돼 있던 task도 함께 복귀한다 (보류 출처를 구분하지 않는 단순화).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: issue, error } = await supabase
    .from('issues')
    .update({ pending_at: null })
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
      .from('tasks').update({ pending_at: null }).in('id', ids);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabase
      .from('tasks').update({ pending_at: null })
      .in('parent_task_id', ids).eq('is_deleted', false);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json(issue);
}
