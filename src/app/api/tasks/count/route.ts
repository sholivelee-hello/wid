import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .not('status', 'in', '("완료","취소","위임")');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ active: count ?? 0 });
}
