'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { CalendarDays, CheckCircle2 } from 'lucide-react';

interface DayDetailPanelProps {
  date: Date | null;
  tasks: Task[];
  events: GCalEvent[];
  subscriptions: CalendarSubscription[];
  onTaskClick: (taskId: string) => void;
}

export function DayDetailPanel({
  date, tasks, events, subscriptions, onTaskClick,
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
      .filter(e => e.calendarId === 'me')
      .filter(e => viewState[e.calendarId]?.visible !== false)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events, dateStr, viewState]
  );

  const dayCompleted = useMemo(() =>
    tasks.filter(t => t.completed_at?.startsWith(dateStr)),
    [tasks, dateStr]
  );

  const totalEmpty = dayEvents.length === 0 && dayCompleted.length === 0;

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

        </>
      )}
    </div>
  );
}
