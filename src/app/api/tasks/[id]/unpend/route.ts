import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 복귀: task + 직계 sub-task의 pending_at 해제. position·issue_id는 건드리지
// 않으므로 원래 자리(계층·순서)로 그대로 돌아간다.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ pending_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: childErr } = await supabase
    .from('tasks')
    .update({ pending_at: null })
    .eq('parent_task_id', id)
    .eq('is_deleted', false);
  if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 });

  return NextResponse.json(data);
}
