import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, format } from 'date-fns';
import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get('month');
  const baseDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

  if (isMockMode()) {
    const allTasks = MOCK_TASKS.filter((t) => {
      if (t.is_deleted) return false;
      const createdInRange = t.created_at >= monthStart.toISOString() && t.created_at <= monthEnd.toISOString();
      const completedInRange = t.completed_at && t.completed_at >= monthStart.toISOString() && t.completed_at <= monthEnd.toISOString();
      return createdInRange || completedInRange;
    });

    const daily_counts = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return {
        date: dayStr,
        completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
      };
    });

    const weekly_comparison = weeks.map((weekStart, i) => ({
      week: `${i + 1}주차`,
      completed: allTasks.filter((t) => {
        if (!t.completed_at) return false;
        const d = new Date(t.completed_at);
        const nextWeek = weeks[i + 1] ?? monthEnd;
        return d >= weekStart && d < nextWeek;
      }).length,
    }));

    const priorityCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    allTasks.forEach((t) => {
      priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
      sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
      statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
    });

    const completedTasks = allTasks.filter((t) => t.completed_at && t.created_at);
    const avgProcessingTime = completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((sum, t) => {
            return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 60000;
          }, 0) / completedTasks.length
        )
      : 0;

    return NextResponse.json({
      month: format(monthStart, 'yyyy-MM'),
      daily_counts,
      weekly_comparison,
      total_completed: allTasks.filter((t) => t.status === '완료').length,
      total_delegated: allTasks.filter((t) => t.status === '위임').length,
      total_cancelled: allTasks.filter((t) => t.status === '취소').length,
      priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
      source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
      status_distribution: Array.from(statusCounts, ([status, count]) => ({ status, count })),
      avg_processing_time: avgProcessingTime,
    });
  }

  const supabase = createServerSupabaseClient();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', false)
    .or(`created_at.gte.${monthStart.toISOString()}.created_at.lte.${monthEnd.toISOString()},completed_at.gte.${monthStart.toISOString()}.completed_at.lte.${monthEnd.toISOString()}`);

  const allTasks = tasks ?? [];

  const daily_counts = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return {
      date: dayStr,
      completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
    };
  });

  const weekly_comparison = weeks.map((weekStart, i) => ({
    week: `${i + 1}주차`,
    completed: allTasks.filter((t) => {
      if (!t.completed_at) return false;
      const d = new Date(t.completed_at);
      const nextWeek = weeks[i + 1] ?? monthEnd;
      return d >= weekStart && d < nextWeek;
    }).length,
  }));

  const priorityCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  allTasks.forEach((t) => {
    priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
    sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  });

  const completedTasks = allTasks.filter((t) => t.completed_at && t.created_at);
  const avgProcessingTime = completedTasks.length > 0
    ? Math.round(
        completedTasks.reduce((sum, t) => {
          return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 60000;
        }, 0) / completedTasks.length
      )
    : 0;

  return NextResponse.json({
    month: format(monthStart, 'yyyy-MM'),
    daily_counts,
    weekly_comparison,
    total_completed: allTasks.filter((t) => t.status === '완료').length,
    total_delegated: allTasks.filter((t) => t.status === '위임').length,
    total_cancelled: allTasks.filter((t) => t.status === '취소').length,
    priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
    source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
    status_distribution: Array.from(statusCounts, ([status, count]) => ({ status, count })),
    avg_processing_time: avgProcessingTime,
  });
}
