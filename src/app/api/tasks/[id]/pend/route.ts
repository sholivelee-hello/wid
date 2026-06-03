import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 보류: task + 직계 sub-task 전체에 pending_at 설정.
// 3-level invariant (ISSUE > TASK > sub-TASK) 덕에 하위 전파는 직계 children
// 한 단계로 충분하다. restore/purge 라우트와 같은 POST-액션 패턴.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .update({ pending_at: now })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: childErr } = await supabase
    .from('tasks')
    .update({ pending_at: now })
    .eq('parent_task_id', id)
    .eq('is_deleted', false);
  if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 });

  return NextResponse.json(data);
}
