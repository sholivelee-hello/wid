import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data: direct, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('issue_id', id)
    .eq('is_deleted', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const directIds = direct.map((t: { id: string }) => t.id);
  const { data: subs } = directIds.length > 0
    ? await supabase.from('tasks').select('*').in('parent_task_id', directIds).eq('is_deleted', false)
    : { data: [] };
  return NextResponse.json([...direct, ...(subs ?? [])]);
}
