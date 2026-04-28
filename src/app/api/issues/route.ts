import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('is_deleted', false)
    .order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const { data: last } = await supabase
    .from('issues')
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = (last?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from('issues')
    .insert({
      name: body.name,
      deadline: body.deadline ?? null,
      sort_mode: body.sort_mode ?? 'checklist',
      position,
      notion_issue_id: body.notion_issue_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
