import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';

// In-memory mutable reference for the dev-mock backend (shared with sibling routes)
const tasks: typeof MOCK_TASKS = [...MOCK_TASKS];
export const __tasksRef = () => tasks;

export async function GET(request: NextRequest) {
  if (isMockMode()) {
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

    let result = tasks.filter((t) => t.is_deleted === showDeleted);
    if (status) result = result.filter((t) => t.status === status);
    if (priority) result = result.filter((t) => t.priority === priority);
    if (source) result = result.filter((t) => t.source === source);
    if (issueId) result = result.filter(t => t.issue_id === issueId);
    if (parentId) result = result.filter(t => t.parent_task_id === parentId);
    if (independent) result = result.filter(t => t.issue_id === null && t.parent_task_id === null);
    if (from || to) {
      result = result.filter((t) => {
        const inRange = (iso: string | null | undefined) => {
          if (!iso) return false;
          if (from && iso < from) return false;
          if (to && iso > `${to}T23:59:59.999Z`) return false;
          return true;
        };
        if (dateField === 'either') {
          return inRange(t.created_at) || inRange(t.completed_at);
        }
        return inRange(t.created_at);
      });
    }

    result.sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[sort] ?? '');
      const bVal = String((b as unknown as Record<string, unknown>)[sort] ?? '');
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return NextResponse.json(result);
  }

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

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', showDeleted);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (source) query = query.eq('source', source);
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
  if (isMockMode()) {
    const body = await request.json();
    const issueId = body.issue_id ?? null;
    const parentId = body.parent_task_id ?? null;
    // Append to the same parent's sibling list so the new task lands at the end.
    const siblings = tasks.filter(t =>
      !t.is_deleted && t.issue_id === issueId && t.parent_task_id === parentId,
    );
    const nextPos = siblings.reduce((m, t) => Math.max(m, t.position), -1) + 1;
    const newTask = {
      id: `mock-${Date.now()}`,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? '보통',
      status: body.status ?? '대기',
      source: body.source ?? 'manual',
      requester: body.requester ?? null,
      requested_at: body.requested_at ?? null,
      created_at: new Date().toISOString(),
      deadline: body.deadline ?? null,
      completed_at: null,
      notion_task_id: null,
      slack_url: body.slack_url ?? null,
      notion_issue: null,
      slack_channel: body.slack_channel ?? null,
      slack_sender: body.slack_sender ?? null,
      delegate_to: null,
      follow_up_note: null,
      issue_id: issueId,
      parent_task_id: parentId,
      sort_mode: 'checklist' as const,
      position: nextPos,
      is_deleted: false,
    };
    tasks.push(newTask);
    return NextResponse.json(newTask, { status: 201 });
  }

  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? '보통',
      status: body.status ?? '대기',
      source: body.source ?? 'manual',
      requester: body.requester ?? null,
      requested_at: body.requested_at ?? null,
      deadline: body.deadline ?? null,
      slack_url: body.slack_url ?? null,
      slack_channel: body.slack_channel ?? null,
      slack_sender: body.slack_sender ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
