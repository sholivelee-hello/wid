import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const now = new Date().toISOString();
    const activeLog = MOCK_TIMELOGS.find((l) => l.task_id === id && l.ended_at === null);
    if (!activeLog) {
      return NextResponse.json({ error: 'No active timer found' }, { status: 404 });
    }
    return NextResponse.json({ ...activeLog, ended_at: now });
  }

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('time_logs')
    .update({ ended_at: now })
    .eq('task_id', id)
    .is('ended_at', null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-sum actual_duration if not manually set
  const task = await supabase.from('tasks').select('is_duration_manual').eq('id', id).single();
  if (!task.data?.is_duration_manual) {
    const { data: logs } = await supabase
      .from('time_logs')
      .select('started_at, ended_at')
      .eq('task_id', id)
      .not('ended_at', 'is', null);

    const totalMinutes = (logs ?? []).reduce((sum, log) => {
      const start = new Date(log.started_at).getTime();
      const end = new Date(log.ended_at!).getTime();
      return sum + Math.round((end - start) / 60000);
    }, 0);

    await supabase.from('tasks').update({ actual_duration: totalMinutes }).eq('id', id);
  }

  return NextResponse.json(data);
}
