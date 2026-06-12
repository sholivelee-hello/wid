import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const dateField = searchParams.get('dateField');
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') ?? 'desc';
  const showDeleted = searchParams.get('deleted') === 'true';
  const pendingOnly = searchParams.get('pending') === 'true';
  const issueId = searchParams.get('issue_id');
  const parentId = searchParams.get('parent_task_id');
  const independent = searchParams.get('independent') === 'true';

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', showDeleted);

  // 보류(pending_at) 필터 — 휴지통 조회(deleted=true)에서는 적용하지 않는다:
  // 보류 중이던 task를 삭제해도 휴지통에는 보여야 한다.
  if (!showDeleted) {
    if (pendingOnly) query = query.not('pending_at', 'is', null);
    else query = query.is('pending_at', null);
  }

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);
  if (issueId) query = query.eq('issue_id', issueId);
  if (parentId) query = query.eq('parent_task_id', parentId);
  if (independent) query = query.is('issue_id', null).is('parent_task_id', null);

  // 단일 사용자(KST) 앱 — date-only(YYYY-MM-DD) 경계는 KST 자정 기준으로 해석.
  // 그대로 넘기면 Postgres가 UTC 자정으로 읽어 경계가 9시간 밀린다.
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const fromTs = from && DATE_ONLY.test(from) ? `${from}T00:00:00+09:00` : from;
  const toTs = to && DATE_ONLY.test(to) ? `${to}T23:59:59.999+09:00` : to;

  if (dateField === 'either' && fromTs && toTs) {
    query = query.or(
      `and(created_at.gte.${fromTs},created_at.lte.${toTs}),and(completed_at.gte.${fromTs},completed_at.lte.${toTs})`
    );
  } else {
    if (fromTs) query = query.gte('created_at', fromTs);
    if (toTs) query = query.lte('created_at', toTs);
  }

  query = query.order(sort, { ascending: order === 'asc' });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  // 3-level 계층 가드 (docs/architecture/hierarchy.md) — sub-of-sub 생성 금지,
  // issue_id ↔ parent_task_id 상호배타.
  if (body.issue_id && body.parent_task_id) {
    return NextResponse.json({ error: 'DUAL_PARENT' }, { status: 400 });
  }
  if (body.parent_task_id) {
    const { data: parent } = await supabase
      .from('tasks')
      .select('id, parent_task_id, is_deleted')
      .eq('id', body.parent_task_id)
      .maybeSingle();
    if (!parent || parent.is_deleted) {
      return NextResponse.json({ error: 'PARENT_NOT_FOUND' }, { status: 400 });
    }
    if (parent.parent_task_id) {
      return NextResponse.json({ error: 'MAX_DEPTH' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
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
