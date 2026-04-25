import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { isMockMode, MOCK_TASKS, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const weekStartParam = request.nextUrl.searchParams.get('week_start');
  const baseDate = weekStartParam ? new Date(weekStartParam) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  if (isMockMode()) {
    const allTasks = MOCK_TASKS.filter((t) => {
      if (t.is_deleted) return false;
      const createdInRange = t.created_at >= weekStart.toISOString() && t.created_at <= weekEnd.toISOString();
      const completedInRange = t.completed_at && t.completed_at >= weekStart.toISOString() && t.completed_at <= weekEnd.toISOString();
      return createdInRange || completedInRange;
    });

    const allLogs = MOCK_TIMELOGS.filter(
      (l) => l.started_at >= weekStart.toISOString() && l.started_at <= weekEnd.toISOString()
    );

    const daily_counts = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return {
        date: dayStr,
        completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
        created: allTasks.filter((t) => t.created_at.startsWith(dayStr)).length,
      };
    });

    const daily_durations = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLogs = allLogs.filter((l) => l.started_at.startsWith(dayStr));
      const duration = dayLogs.reduce((sum, log) => {
        if (!log.ended_at) return sum;
        return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
      }, 0);
      return { date: dayStr, duration };
    });

    const priorityCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    allTasks.forEach((t) => {
      priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
      sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
    });

    const tasks_by_day: Record<string, typeof allTasks> = {};
    days.forEach((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      tasks_by_day[dayStr] = allTasks.filter(
        (t) => t.created_at.startsWith(dayStr) || t.completed_at?.startsWith(dayStr)
      );
    });

    return NextResponse.json({
      week_start: format(weekStart, 'yyyy-MM-dd'),
      daily_counts,
      total_completed: allTasks.filter((t) => t.status === '완료').length,
      total_delegated: allTasks.filter((t) => t.status === '위임').length,
      total_cancelled: allTasks.filter((t) => t.status === '취소').length,
      priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
      source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
      daily_durations,
      tasks_by_day,
    });
  }

  const supabase = createServerSupabaseClient();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', false)
    .or(`created_at.gte.${weekStart.toISOString()}.created_at.lte.${weekEnd.toISOString()},completed_at.gte.${weekStart.toISOString()}.completed_at.lte.${weekEnd.toISOString()}`);

  const { data: timelogs } = await supabase
    .from('time_logs')
    .select('*')
    .gte('started_at', weekStart.toISOString())
    .lte('started_at', weekEnd.toISOString());

  const allTasks = tasks ?? [];
  const allLogs = timelogs ?? [];

  const daily_counts = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return {
      date: dayStr,
      completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
      created: allTasks.filter((t) => t.created_at.startsWith(dayStr)).length,
    };
  });

  const daily_durations = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLogs = allLogs.filter((l) => l.started_at.startsWith(dayStr));
    const duration = dayLogs.reduce((sum, log) => {
      if (!log.ended_at) return sum;
      return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
    }, 0);
    return { date: dayStr, duration };
  });

  const priorityCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  allTasks.forEach((t) => {
    priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
    sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
  });

  // tasks_by_day for weekly task flow view
  const tasks_by_day: Record<string, typeof allTasks> = {};
  days.forEach((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    tasks_by_day[dayStr] = allTasks.filter(
      (t) => t.created_at.startsWith(dayStr) || t.completed_at?.startsWith(dayStr)
    );
  });

  return NextResponse.json({
    week_start: format(weekStart, 'yyyy-MM-dd'),
    daily_counts,
    total_completed: allTasks.filter((t) => t.status === '완료').length,
    total_delegated: allTasks.filter((t) => t.status === '위임').length,
    total_cancelled: allTasks.filter((t) => t.status === '취소').length,
    priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
    source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
    daily_durations,
    tasks_by_day,
  });
}
