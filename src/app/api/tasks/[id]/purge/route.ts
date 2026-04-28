import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 휴지통의 task를 실제로 DB에서 삭제. 안전을 위해 is_deleted=true 인 항목만
// 허용한다 — 활성 task가 실수로 영구 삭제되는 것을 방지.
// 이 task의 하위 task도 함께 삭제 (휴지통에 들어갈 때 자식까지 같이 들어가는
// 정책이 아니어서, 부모만 영구 삭제하면 자식이 부모 없이 떠돌게 되므로
// 동일 트랜잭션에서 제거).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: target, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, is_deleted')
    .eq('id', id)
    .single();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 404 });
  }
  if (!target.is_deleted) {
    return NextResponse.json(
      { error: '휴지통에 있는 task만 영구 삭제할 수 있어요.' },
      { status: 400 },
    );
  }

  // 자식 task 먼저 — FK 제약이 없을 수도 있어 명시적으로 정리.
  const { error: childErr } = await supabase
    .from('tasks')
    .delete()
    .eq('parent_task_id', id);
  if (childErr) {
    return NextResponse.json({ error: childErr.message }, { status: 500 });
  }

  const { error: delErr } = await supabase.from('tasks').delete().eq('id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
