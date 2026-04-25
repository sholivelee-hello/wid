import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TIMELOGS, MOCK_TASKS } from '@/lib/mock-data';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const { id, logId } = await params;

  if (isMockMode()) {
    const index = MOCK_TIMELOGS.findIndex(l => l.id === logId && l.task_id === id);
    if (index === -1) return NextResponse.json({ error: 'not found' }, { status: 404 });
    MOCK_TIMELOGS.splice(index, 1);
    // Recalculate actual_duration
    const taskLogs = MOCK_TIMELOGS.filter(l => l.task_id === id && l.ended_at);
    const totalMinutes = taskLogs.reduce((sum, log) => {
      return sum + Math.round((new Date(log.ended_at!).getTime() - new Date(log.started_at).getTime()) / 60000);
    }, 0);
    const task = MOCK_TASKS.find(t => t.id === id);
    if (task && !task.is_duration_manual) {
      task.actual_duration = totalMinutes || null;
    }
    return NextResponse.json({ success: true });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('time_logs')
    .delete()
    .eq('id', logId)
    .eq('task_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recalculate actual_duration
  const { data: task } = await supabase.from('tasks').select('is_duration_manual').eq('id', id).single();
  if (!task?.is_duration_manual) {
    const { data: logs } = await supabase
      .from('time_logs')
      .select('started_at, ended_at')
      .eq('task_id', id)
      .not('ended_at', 'is', null);

    const totalMinutes = (logs ?? []).reduce((sum, log) => {
      return sum + Math.round((new Date(log.ended_at!).getTime() - new Date(log.started_at).getTime()) / 60000);
    }, 0);
    await supabase.from('tasks').update({ actual_duration: totalMinutes || null }).eq('id', id);
  }

  return NextResponse.json({ success: true });
}
