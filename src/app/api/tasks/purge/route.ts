import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 휴지통 비우기 — is_deleted=true 인 task와 그 자식들을 모두 영구 삭제.
export async function DELETE() {
  const supabase = createServerSupabaseClient();

  const { data: trashed, error: fetchErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('is_deleted', true);
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!trashed || trashed.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const ids = trashed.map((t) => t.id);

  // 자식부터: parent_task_id 가 휴지통 task 중 하나인 row 모두 제거.
  const { error: childErr } = await supabase
    .from('tasks')
    .delete()
    .in('parent_task_id', ids);
  if (childErr) {
    return NextResponse.json({ error: childErr.message }, { status: 500 });
  }

  const { error: delErr } = await supabase.from('tasks').delete().in('id', ids);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
