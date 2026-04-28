import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const source = searchParams.get('source');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const dateField = searchParams.get('dateField');
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') ?? 'desc';
  const showDeleted = searchParams.get('deleted') === 'true';
  const issueId = searchParams.get('issue_id');
  const parentId = searchParams.get('parent_task_id');
  const independent = searchParams.get('independent') === 'true';

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', showDeleted);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (source) query = query.eq('source', source);
  if (issueId) query = query.eq('issue_id', issueId);
  if (parentId) query = query.eq('parent_task_id', parentId);
  if (independent) query = query.is('issue_id', null).is('parent_task_id', null);

  if (dateField === 'either' && from && to) {
    query = query.or(
      `and(created_at.gte.${from},created_at.lte.${to}T23:59:59.999Z),and(completed_at.gte.${from},completed_at.lte.${to}T23:59:59.999Z)`
    );
  } else {
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);
  }

  query = query.order(sort, { ascending: order === 'asc' });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? '보통',
      status: body.status ?? '등록',
      source: body.source ?? 'manual',
      requester: body.requester ?? null,
      requested_at: body.requested_at ?? null,
      deadline: body.deadline ?? null,
      slack_url: body.slack_url ?? null,
      slack_channel: body.slack_channel ?? null,
      slack_sender: body.slack_sender ?? null,
      issue_id: body.issue_id ?? null,
      parent_task_id: body.parent_task_id ?? null,
      sort_mode: body.sort_mode ?? 'checklist',
      position: body.position ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
