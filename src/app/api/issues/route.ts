import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const pendingOnly = request.nextUrl.searchParams.get('pending') === 'true';
  let query = supabase
    .from('issues')
    .select('*')
    .eq('is_deleted', false)
    .order('position', { ascending: true });
  // 기본은 보류 제외 — 인박스 트리·IssuePicker에서 보류된 ISSUE가 숨겨진다.
  query = pendingOnly
    ? query.not('pending_at', 'is', null)
    : query.is('pending_at', null);
  const { data, error } = await query;
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
