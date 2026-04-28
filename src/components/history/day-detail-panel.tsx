'use client';

import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import type { Task } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { getGCalConfig, getCalendarColor, getCalendarLabel, GCAL_EMBED_EVENT, type GCalConfig } from '@/lib/gcal-embed';
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

  const [gcalConfig, setGcalConfig] = useState<GCalConfig>(() => getGCalConfig());
  useEffect(() => {
    const update = () => setGcalConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, update);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, update);
  }, []);

  // All hooks must run before any early return
  const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
  const dateLabel = date ? format(date, 'M월 d일 (EEEE)', { locale: ko }) : null;

  const dayEvents = useMemo(() => {
    if (!dateStr) return [];
    return events
      .filter(e => e.date === dateStr)
      .filter(e => viewState[e.calendarId]?.visible !== false)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }, [events, dateStr, viewState]);

  const dayCompleted = useMemo(() => {
    if (!dateStr) return [];
    return tasks.filter(t => t.status === '완료' && t.completed_at?.startsWith(dateStr));
  }, [tasks, dateStr]);

  if (!date || !dateStr || !dateLabel) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        왼쪽 달력에서 날짜를 선택하세요
      </div>
    );
  }

  const totalEmpty = dayEvents.length === 0 && dayCompleted.length === 0;
  const config = gcalConfig;
  const calendarConnected = config.oauth !== null || config.subscribedCalendars.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold tracking-[-0.025em]">
          {dateLabel}
        </h3>
      </div>

      {totalEmpty ? (
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>이 날짜에 활동이 없습니다</p>
          {!calendarConnected ? (
            <p>
              <Link href="/settings" className="text-primary hover:underline">
                Settings에서 캘린더를 연결
              </Link>
              하면 일정이 함께 표시됩니다
            </p>
          ) : (
            <p>다른 날짜를 선택해 보세요</p>
          )}
        </div>
      ) : (
        <>
          {dayEvents.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <CalendarDays className="h-3 w-3" /> 일정 ({dayEvents.length})
              </h4>
              <div className="space-y-1.5">
                {dayEvents.map(ev => {
                  // Prefer the viewState color (user-overridden) then gcal-embed helper
                  const color = viewState[ev.calendarId]?.color || getCalendarColor(ev.calendarId, gcalConfig);

                  // Owner label: prefer gcal-embed label, fall back to subscriptions lookup
                  const subscribedCal = subscriptions.find(c => c.id === ev.calendarId);
                  const isPrimary = gcalConfig.subscribedCalendars.find(c => c.id === ev.calendarId)?.primary === true;
                  const ownerLabel = isPrimary
                    ? null
                    : (getCalendarLabel(ev.calendarId, gcalConfig) !== ev.calendarId
                        ? getCalendarLabel(ev.calendarId, gcalConfig)
                        : subscribedCal?.name ?? null);

                  const start = ev.time?.slice(0, 5);
                  const end = ev.endTime?.slice(0, 5);
                  const timeLabel = start
                    ? (end ? `${start}–${end}` : start)
                    : '종일';
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/40 hover:border-foreground/20 transition-colors"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      <CalendarDays
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color }}
                        aria-hidden="true"
                      />
                      <span className="font-mono tabular-nums text-xs text-muted-foreground min-w-[64px] shrink-0 pt-0.5">
                        {timeLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{ev.title}</div>
                        {ownerLabel && (
                          <div className="text-xs text-muted-foreground truncate">{ownerLabel}</div>
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
                <CheckCircle2 className="h-3 w-3 text-primary" /> 완료한 task ({dayCompleted.length})
              </h4>
              <div className="space-y-1">
                {dayCompleted.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTaskClick(t.id)}
                    className="w-full text-left flex items-start gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/40 hover:border-foreground/20 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="font-mono tabular-nums text-xs text-muted-foreground min-w-[64px] shrink-0 pt-0.5">
                      {t.completed_at ? format(new Date(t.completed_at), 'HH:mm') : '-'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                    </div>
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
