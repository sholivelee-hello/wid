import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';

export async function GET() {
  if (isMockMode()) {
    const active = MOCK_TASKS.filter(t =>
      !t.is_deleted && !['완료', '취소', '위임'].includes(t.status)
    ).length;
    return NextResponse.json({ active });
  }

  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .not('status', 'in', '("완료","취소","위임")');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ active: count ?? 0 });
}
