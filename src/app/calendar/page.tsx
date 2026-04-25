'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, isSameMonth, startOfMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WeekView } from '@/components/calendar/week-view';
import { MiniMonthPicker } from '@/components/calendar/mini-month-picker';
import { CalendarSubscriptions } from '@/components/layout/calendar-subscriptions';
import { apiFetch } from '@/lib/api';
import type { GCalEvent } from '@/lib/mock-gcal';

export default function CalendarPage() {
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
  const fromStr = format(selectedWeekStart, 'yyyy-MM-dd');
  const toStr = format(weekEnd, 'yyyy-MM-dd');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<GCalEvent[]>(
        `/api/gcal/events?from=${fromStr}&to=${toStr}`,
        { suppressToast: true }
      );
      setEvents(data);
    } catch {}
    finally { setLoading(false); }
  }, [fromStr, toStr]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const navigate = (ws: Date) => {
    setSelectedWeekStart(ws);
    if (!isSameMonth(ws, monthCursor)) setMonthCursor(startOfMonth(ws));
  };

  const handleWeekSelect = (weekStart: Date) => {
    navigate(startOfWeek(weekStart, { weekStartsOn: 1 }));
  };

  const isCurrentWeek = isToday(selectedWeekStart) ||
    (selectedWeekStart <= new Date() && new Date() <= weekEnd);

  const weekLabel = `${format(selectedWeekStart, 'M월 d일', { locale: ko })} – ${format(weekEnd, 'M월 d일', { locale: ko })}`;
  const eventDates = new Set(events.map(ev => ev.date));

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(subWeeks(selectedWeekStart, 1))} aria-label="이전 주">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1
          className="text-xl font-bold min-w-[260px] text-center"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {weekLabel}
          {isCurrentWeek && (
            <span className="ml-2 text-sm font-normal text-primary">이번 주</span>
          )}
        </h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(addWeeks(selectedWeekStart, 1))} aria-label="다음 주">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentWeek && (
          <Button variant="outline" size="sm" onClick={() => navigate(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            이번 주
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left: mini month + subscriptions */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3">
            <MiniMonthPicker
              selectedWeekStart={selectedWeekStart}
              monthCursor={monthCursor}
              onMonthChange={setMonthCursor}
              onWeekSelect={handleWeekSelect}
              eventDates={eventDates}
            />
          </div>
          <div className="rounded-lg border bg-card">
            <CalendarSubscriptions />
          </div>
        </div>

        {/* Right: week view */}
        <div>
          {loading ? (
            <div className="h-64 rounded-lg bg-muted/30 animate-pulse" />
          ) : (
            <WeekView weekStart={selectedWeekStart} events={events} />
          )}
        </div>
      </div>
    </div>
  );
}
