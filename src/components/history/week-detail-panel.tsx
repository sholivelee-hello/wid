'use client';

import { useMemo } from 'react';
import { format, eachDayOfInterval, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task, TimeLog } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { CheckCircle2, Clock } from 'lucide-react';

interface WeekDetailPanelProps {
  weekStart: Date | null;
  tasks: Task[];
  events: GCalEvent[];
  timeLogs: TimeLog[];
  subscriptions: CalendarSubscription[];
  onTaskClick: (taskId: string) => void;
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function WeekDetailPanel({
  weekStart, tasks, events, timeLogs, subscriptions, onTaskClick,
}: WeekDetailPanelProps) {
  const viewState = useCalendarViewState(subscriptions);

  if (!weekStart) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        달력에서 주를 선택하세요
      </div>
    );
  }

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekFromStr = format(weekStart, 'yyyy-MM-dd');
  const weekToStr = format(weekEnd, 'yyyy-MM-dd');
  const weekLabel = `${format(weekStart, 'M월 d일', { locale: ko })} – ${format(weekEnd, 'M월 d일', { locale: ko })}`;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const eventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    for (const ev of events) {
      if (ev.calendarId !== 'me') continue;
      if (viewState[ev.calendarId]?.visible === false) continue;
      if (ev.date < weekFromStr || ev.date > weekToStr) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events, weekFromStr, weekToStr, viewState]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const completedTasks = useMemo(
    () => tasks.filter(t => {
      const d = t.completed_at?.slice(0, 10);
      return d && d >= weekFromStr && d <= weekToStr;
    }),
    [tasks, weekFromStr, weekToStr]
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const workedTasks = useMemo(() => {
    const byTask = new Map<string, number>();
    for (const log of timeLogs) {
      const d = log.started_at.slice(0, 10);
      if (d < weekFromStr || d > weekToStr || !log.ended_at) continue;
      const mins = Math.round(
        (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000
      );
      byTask.set(log.task_id, (byTask.get(log.task_id) ?? 0) + mins);
    }
    return [...byTask.entries()]
      .map(([taskId, mins]) => ({ task: tasks.find(t => t.id === taskId), minutes: mins }))
      .filter((x): x is { task: Task; minutes: number } => !!x.task)
      .sort((a, b) => b.minutes - a.minutes);
  }, [timeLogs, tasks, weekFromStr, weekToStr]);

  const totalEvents = [...eventsByDate.values()].reduce((s, a) => s + a.length, 0);
  const isEmpty = totalEvents === 0 && completedTasks.length === 0 && workedTasks.length === 0;

  return (
    <div className="space-y-5 overflow-y-auto">
      <h3 className="text-base font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {weekLabel}
      </h3>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">이 주에 활동이 없습니다</p>
      ) : (
        <>
          {totalEvents > 0 && (
            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                일정 ({totalEvents})
              </h4>
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvs = eventsByDate.get(dateStr);
                if (!dayEvs?.length) return null;
                return (
                  <div key={dateStr}>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1">
                      {format(day, 'M월 d일 (E)', { locale: ko })}
                    </div>
                    <div className="space-y-1">
                      {dayEvs.map(ev => {
                        const color = viewState[ev.calendarId]?.color ?? '#6366F1';
                        return (
                          <div
                            key={ev.id}
                            className="text-sm px-2.5 py-1.5 rounded-md"
                            style={{ borderLeft: `3px solid ${color}`, backgroundColor: `${color}10` }}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {completedTasks.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                완료한 task ({completedTasks.length})
              </h4>
              <div className="space-y-1">
                {completedTasks.map(t => (
                  <button key={t.id} type="button" onClick={() => onTaskClick(t.id)}
                    className="w-full text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    {t.completed_at && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(t.completed_at), 'M/d HH:mm')} 완료
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {workedTasks.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                작업한 task ({workedTasks.length})
              </h4>
              <div className="space-y-1">
                {workedTasks.map(({ task, minutes }) => (
                  <button key={task.id} type="button" onClick={() => onTaskClick(task.id)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors">
                    <span className="flex-1 text-sm font-medium truncate">{task.title}</span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {minutesToLabel(minutes)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
