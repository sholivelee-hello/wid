import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay } from 'date-fns';
import { isMockMode, MOCK_TASKS, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateParam);
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  if (isMockMode()) {
    const tasks = MOCK_TASKS.filter((t) => {
      if (t.is_deleted) return false;
      const createdInRange = t.created_at >= dayStart && t.created_at <= dayEnd;
      const completedInRange = t.completed_at && t.completed_at >= dayStart && t.completed_at <= dayEnd;
      const isInProgress = t.status === '진행중';
      return createdInRange || completedInRange || isInProgress;
    });

    const timelogs = MOCK_TIMELOGS.filter(
      (l) => l.started_at >= dayStart && l.started_at <= dayEnd
    );

    const completed_count = tasks.filter(
      (t) => t.status === '완료' && t.completed_at && t.completed_at >= dayStart && t.completed_at <= dayEnd
    ).length;

    const in_progress_count = tasks.filter((t) => t.status === '진행중').length;

    const total_duration = timelogs.reduce((sum, log) => {
      if (!log.ended_at) return sum;
      return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
    }, 0);

    return NextResponse.json({
      date: dateParam,
      completed_count,
      total_duration,
      in_progress_count,
      tasks,
      timelogs,
    });
  }

  const supabase = createServerSupabaseClient();

  const [tasksResult, timelogsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('is_deleted', false)
      .or(`created_at.gte.${dayStart},completed_at.gte.${dayStart},status.eq.진행중`)
      .or(`created_at.lte.${dayEnd},completed_at.lte.${dayEnd},status.eq.진행중`),
    supabase
      .from('time_logs')
      .select('*, tasks!inner(is_deleted)')
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd),
  ]);

  const tasks = tasksResult.data ?? [];
  const timelogs = timelogsResult.data ?? [];

  const completed_count = tasks.filter(
    (t) => t.status === '완료' && t.completed_at && t.completed_at >= dayStart && t.completed_at <= dayEnd
  ).length;

  const in_progress_count = tasks.filter((t) => t.status === '진행중').length;

  const total_duration = timelogs.reduce((sum, log) => {
    if (!log.ended_at) return sum;
    return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
  }, 0);

  return NextResponse.json({
    date: dateParam,
    completed_count,
    total_duration,
    in_progress_count,
    tasks,
    timelogs,
  });
}
