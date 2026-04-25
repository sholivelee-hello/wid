import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const now = new Date().toISOString();
    const task = MOCK_TASKS.find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const newTimelog = {
      id: `mock-tl-${Date.now()}`,
      task_id: id,
      started_at: now,
      ended_at: null,
    };
    return NextResponse.json(newTimelog, { status: 201 });
  }

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  // Stop all running timers
  await supabase
    .from('time_logs')
    .update({ ended_at: now })
    .is('ended_at', null);

  // Start new timer
  const { data, error } = await supabase
    .from('time_logs')
    .insert({ task_id: id, started_at: now })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update task started_at on first start
  await supabase
    .from('tasks')
    .update({ started_at: now, status: '진행중' })
    .eq('id', id)
    .is('started_at', null);

  return NextResponse.json(data, { status: 201 });
}
