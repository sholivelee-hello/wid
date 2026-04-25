import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (isMockMode()) {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (body.status === '완료' && !body.completed_at) {
      body.completed_at = new Date().toISOString();
    }

    const updated = { ...task, ...body };
    return NextResponse.json(updated);
  }

  const supabase = createServerSupabaseClient();

  if (body.status === '완료' && !body.completed_at) {
    body.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ ...task, is_deleted: true });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_deleted: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
