'use client';

import { useMemo, useState, useEffect } from 'react';
import { format, eachDayOfInterval, endOfWeek, getWeekOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import type { Task } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { getGCalConfig, getCalendarColor, GCAL_EMBED_EVENT, type GCalConfig } from '@/lib/gcal-embed';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekDetailPanelProps {
  weekStart: Date | null;
  tasks: Task[];
  events: GCalEvent[];
  subscriptions: CalendarSubscription[];
  onTaskClick: (taskId: string) => void;
  onDayClick?: (dateStr: string) => void;
  onWeekChange?: (direction: 'prev' | 'next') => void;
}

export function WeekDetailPanel({
  weekStart, tasks, events, subscriptions, onTaskClick, onDayClick, onWeekChange,
}: WeekDetailPanelProps) {
  const viewState = useCalendarViewState(subscriptions);

  const [gcalConfig, setGcalConfig] = useState<GCalConfig>(() => getGCalConfig());
  useEffect(() => {
    const update = () => setGcalConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, update);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, update);
  }, []);

  // All hooks must run before any early return (React rules of hooks).
  const weekFromStr = weekStart ? format(weekStart, 'yyyy-MM-dd') : null;
  const weekToStr = weekStart ? format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd') : null;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    if (!weekFromStr || !weekToStr) return map;
    for (const ev of events) {
      if (viewState[ev.calendarId]?.visible === false) continue;
      if (ev.date < weekFromStr || ev.date > weekToStr) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events, weekFromStr, weekToStr, viewState]);

  const completedTasks = useMemo(
    () => {
      if (!weekFromStr || !weekToStr) return [] as Task[];
      return tasks.filter(t => {
        const d = t.completed_at?.slice(0, 10);
        return t.status === '완료' && d && d >= weekFromStr && d <= weekToStr;
      });
    },
    [tasks, weekFromStr, weekToStr]
  );

  const completedByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of completedTasks) {
      const d = t.completed_at?.slice(0, 10);
      if (!d) continue;
      const list = map.get(d) ?? [];
      list.push(t);
      map.set(d, list);
    }
    // sort tasks within each day by completion time
    map.forEach(list => list.sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? '')));
    return map;
  }, [completedTasks]);

  if (!weekStart || !weekFromStr || !weekToStr) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        달력에서 주를 선택하세요
      </div>
    );
  }

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const totalEvents = [...eventsByDate.values()].reduce((s, a) => s + a.length, 0);
  const isEmpty = totalEvents === 0 && completedTasks.length === 0;
  const calendarConnected = gcalConfig.oauth !== null || gcalConfig.subscribedCalendars.length > 0;
  const monthWeekLabel = `${format(weekStart, 'M', { locale: ko })}월 ${getWeekOfMonth(weekStart, { weekStartsOn: 1 })}주차`;

  return (
    <div className="space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {monthWeekLabel}
        </h3>
        {onWeekChange && (
          <div className="inline-flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange('prev')}
              aria-label="이전 주"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange('next')}
              aria-label="다음 주"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>이 주에 활동이 없습니다</p>
          {!calendarConnected ? (
            <p>
              <Link href="/settings" className="text-primary hover:underline">
                Settings에서 캘린더를 연결
              </Link>
              하면 일정이 함께 표시됩니다
            </p>
          ) : (
            <p>다른 주를 선택해 보세요</p>
          )}
        </div>
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
                const dayLabel = format(day, 'M월 d일 (E)', { locale: ko });
                return (
                  <div key={dateStr}>
                    {onDayClick ? (
                      <button
                        type="button"
                        onClick={() => onDayClick(dateStr)}
                        className="group flex items-center gap-1.5 -mx-2 px-2 py-1 mb-1 rounded-md hover:bg-accent transition-colors text-left w-full"
                        aria-label={`${dayLabel} 일별 보기로 전환`}
                      >
                        <span className="text-xs font-medium text-foreground">{dayLabel}</span>
                        <span className="text-[11px] text-muted-foreground">({dayEvs.length})</span>
                        <ChevronRight className="ml-auto w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    ) : (
                      <div className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                        <span>{dayLabel}</span>
                        <span className="text-[11px] text-muted-foreground">({dayEvs.length})</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {dayEvs.map(ev => {
                        const color = viewState[ev.calendarId]?.color || getCalendarColor(ev.calendarId, gcalConfig);
                        return (
                          <div
                            key={ev.id}
                            className="text-sm px-2.5 py-1.5 rounded-md bg-muted/30 flex items-center gap-1.5"
                            style={{ borderLeft: `3px solid ${color}` }}
                          >
                            <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0">
                              {ev.time?.slice(0, 5) ?? '종일'}
                            </span>
                            <span className="truncate">{ev.title}</span>
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
            <section className="space-y-3">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                완료한 task ({completedTasks.length})
              </h4>
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayTasks = completedByDate.get(dateStr);
                if (!dayTasks?.length) return null;
                const dayLabel = format(day, 'M월 d일 (E)', { locale: ko });
                return (
                  <div key={dateStr}>
                    {onDayClick ? (
                      <button
                        type="button"
                        onClick={() => onDayClick(dateStr)}
                        className="group flex items-center gap-1.5 -mx-2 px-2 py-1 mb-1 rounded-md hover:bg-accent transition-colors text-left w-full"
                        aria-label={`${dayLabel} 일별 보기로 전환`}
                      >
                        <span className="text-xs font-medium text-foreground">{dayLabel}</span>
                        <span className="text-[11px] text-muted-foreground">({dayTasks.length})</span>
                        <ChevronRight className="ml-auto w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    ) : (
                      <div className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                        <span>{dayLabel}</span>
                        <span className="text-[11px] text-muted-foreground">({dayTasks.length})</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {dayTasks.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onTaskClick(t.id)}
                          className="w-full text-left px-3 py-2 rounded-md border bg-card hover:bg-accent/50 hover:border-foreground/20 transition-colors flex items-start gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="flex-1 min-w-0 flex items-baseline gap-2">
                            {t.completed_at && (
                              <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0">
                                {format(new Date(t.completed_at), 'HH:mm')}
                              </span>
                            )}
                            <span className="text-sm font-medium truncate">{t.title}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

        </>
      )}
    </div>
  );
}
