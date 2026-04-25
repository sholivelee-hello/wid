'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task, TimeLog } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { Clock, CalendarDays, CheckCircle2 } from 'lucide-react';

interface DayDetailPanelProps {
  date: Date | null;
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

export function DayDetailPanel({
  date, tasks, events, timeLogs, subscriptions, onTaskClick,
}: DayDetailPanelProps) {
  const viewState = useCalendarViewState(subscriptions);

  if (!date) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        왼쪽 달력에서 날짜를 선택하세요
      </div>
    );
  }

  const dateStr = format(date, 'yyyy-MM-dd');
  const dateLabel = format(date, 'M월 d일 (EEEE)', { locale: ko });

  const dayEvents = useMemo(() =>
    events
      .filter(e => e.date === dateStr)
      .filter(e => viewState[e.calendarId]?.visible !== false)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events, dateStr, viewState]
  );

  const dayCompleted = useMemo(() =>
    tasks.filter(t => t.completed_at?.startsWith(dateStr)),
    [tasks, dateStr]
  );

  const dayWorked = useMemo(() => {
    const logsByTask = new Map<string, number>();
    for (const log of timeLogs) {
      if (!log.started_at.startsWith(dateStr)) continue;
      if (!log.ended_at) continue;
      const mins = Math.round(
        (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000
      );
      logsByTask.set(log.task_id, (logsByTask.get(log.task_id) ?? 0) + mins);
    }
    return [...logsByTask.entries()]
      .map(([taskId, mins]) => ({
        task: tasks.find(t => t.id === taskId),
        minutes: mins,
      }))
      .filter((x): x is { task: Task; minutes: number } => !!x.task)
      .sort((a, b) => b.minutes - a.minutes);
  }, [timeLogs, tasks, dateStr]);

  const totalEmpty = dayEvents.length === 0 && dayCompleted.length === 0 && dayWorked.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {dateLabel}
        </h3>
      </div>

      {totalEmpty ? (
        <p className="text-sm text-muted-foreground">이 날짜에 활동이 없습니다</p>
      ) : (
        <>
          {dayEvents.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <CalendarDays className="h-3 w-3" /> 일정 ({dayEvents.length})
              </h4>
              <div className="space-y-1.5">
                {dayEvents.map(ev => {
                  const color = viewState[ev.calendarId]?.color ?? '#6366F1';
                  const owner = subscriptions.find(c => c.id === ev.calendarId);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2 text-sm p-2 rounded-md border"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      <span className="font-mono tabular-nums text-xs text-muted-foreground w-16 flex-shrink-0 pt-0.5">
                        {ev.time?.slice(0, 5) ?? '종일'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{ev.title}</div>
                        {owner && ev.calendarId !== 'me' && (
                          <div className="text-xs text-muted-foreground">{owner.name}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {dayCompleted.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 완료한 task ({dayCompleted.length})
              </h4>
              <div className="space-y-1">
                {dayCompleted.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTaskClick(t.id)}
                    className="w-full text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors"
                  >
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    {t.completed_at && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(t.completed_at), 'HH:mm')} 완료
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {dayWorked.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3 w-3" /> 작업한 task ({dayWorked.length})
              </h4>
              <div className="space-y-1">
                {dayWorked.map(({ task, minutes }) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors"
                  >
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
