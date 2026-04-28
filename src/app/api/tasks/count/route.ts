import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  // 사이드바 인박스 배지 = 사용자가 처리해야 할 모든 활성 task 수.
  // sub-task도 포함 (인박스 트리 빌더가 고아 sub-task도 표면화하도록 바뀌어
  // 있어서 sub 1개가 떠도 사이드바와 화면이 일치한다).
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .not('status', 'in', '("완료","취소","위임")');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ active: count ?? 0 });
}
