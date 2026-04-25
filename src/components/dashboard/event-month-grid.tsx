'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isWithinInterval,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';

interface EventMonthGridProps {
  /** The currently-selected date (used to highlight the containing week). */
  selectedDate: Date;
  /** The month currently on display. */
  monthCursor: Date;
  /** When the user navigates to a different month. */
  onMonthChange: (d: Date) => void;
  /** When the user picks a week (by clicking a day or a week row). */
  onWeekSelect: (d: Date) => void;
  /** When the user clicks a specific day. */
  onDaySelect?: (d: Date) => void;
  /** Events to show on the grid. */
  events: GCalEvent[];
  /** Number of completed items per date key (yyyy-MM-dd). */
  completedCountByDate?: Map<string, number>;
  /** Set of date keys (yyyy-MM-dd) to highlight for search results. */
  searchHighlightDates?: Set<string>;
  /** When true, disables week click behavior (read-only calendar). */
  readOnly?: boolean;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function EventMonthGrid({
  selectedDate,
  monthCursor,
  onMonthChange,
  onWeekSelect,
  onDaySelect,
  events,
  completedCountByDate,
  searchHighlightDates,
  readOnly,
}: EventMonthGridProps) {
  const viewState = useCalendarViewState(MOCK_CALENDARS);

  // Filter events by calendar visibility
  const visibleEvents = useMemo(
    () => events.filter(ev => viewState[ev.calendarId]?.visible !== false),
    [events, viewState]
  );

  // Calculate the month's visible day grid (always 6 weeks for stable height)
  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Group days into weeks (rows of 7)
  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      out.push(days.slice(i, i + 7));
    }
    return out;
  }, [days]);

  // Index events by date string for fast lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    visibleEvents.forEach(ev => {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    });
    // Sort each day's events by time
    map.forEach(list => list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')));
    return map;
  }, [visibleEvents]);

  const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  return (
    <div className="w-full max-w-[640px] select-none">
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMonthChange(addMonths(monthCursor, -1))}
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3
          className="text-sm font-semibold"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {format(monthCursor, 'yyyy년 M월', { locale: ko })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMonthChange(addMonths(monthCursor, 1))}
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className={cn(
              'text-center text-[11px] font-medium text-muted-foreground py-1',
              i === 5 && 'text-blue-500',
              i === 6 && 'text-red-500'
            )}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-1">
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const isSelectedWeek = isWithinInterval(weekStart, {
            start: selectedWeekStart,
            end: selectedWeekEnd,
          });

          const weekCells = week.map((day, di) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const isCurrentMonth = isSameMonth(day, monthCursor);
            const today = isToday(day);
            const isWeekend = di === 5 || di === 6;

            const dayCellContent = (
              <>
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-medium tabular-nums',
                      today && 'bg-primary text-primary-foreground',
                      !today && isCurrentMonth && isWeekend && di === 6 && 'text-red-500',
                      !today && isCurrentMonth && isWeekend && di === 5 && 'text-blue-500'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {completedCountByDate && completedCountByDate.get(dateStr) ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ● {completedCountByDate.get(dateStr)}
                    </span>
                  ) : null}
                </div>

                {/* Events (max 3 visible) */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const evColor = viewState[ev.calendarId]?.color ?? '#6366F1';
                    return (
                      <div
                        key={ev.id}
                        style={{
                          backgroundColor: `${evColor}1A`,
                          color: evColor,
                          borderLeft: `2px solid ${evColor}`,
                        }}
                        className="text-[10px] leading-tight rounded px-1 py-0.5 truncate font-medium"
                        title={`${ev.time ?? ''} ${ev.title}${ev.location ? ` · ${ev.location}` : ''}`}
                      >
                        {ev.time && <span className="mr-1 font-mono tabular-nums opacity-80">{ev.time.slice(0, 5)}</span>}
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3}
                    </div>
                  )}
                </div>
              </>
            );

            return (
              <div
                key={dateStr}
                className={cn(
                  'min-h-[76px] rounded-md border border-transparent p-1.5 text-left transition-colors',
                  isCurrentMonth ? 'bg-background' : 'bg-muted/20',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  searchHighlightDates?.has(dateStr) && 'ring-2 ring-primary ring-offset-1'
                )}
              >
                {onDaySelect ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDaySelect(day);
                    }}
                    className="w-full h-full text-left"
                    aria-label={`${format(day, 'M월 d일', { locale: ko })} 선택`}
                  >
                    {dayCellContent}
                  </button>
                ) : (
                  <>{dayCellContent}</>
                )}
              </div>
            );
          });

          if (readOnly) {
            return (
              <div
                key={wi}
                className="grid grid-cols-7 gap-px w-full rounded-md p-0.5"
              >
                {weekCells}
              </div>
            );
          }

          return (
            <button
              key={wi}
              type="button"
              onClick={() => onWeekSelect(weekStart)}
              className={cn(
                'group/week grid grid-cols-7 gap-px w-full rounded-md p-0.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelectedWeek
                  ? 'bg-primary/5 ring-1 ring-primary/30'
                  : 'hover:bg-accent/50 cursor-pointer'
              )}
              aria-label={`${format(weekStart, 'M월 d일', { locale: ko })} 주 선택`}
              aria-pressed={isSelectedWeek}
            >
              {weekCells}
            </button>
          );
        })}
      </div>

      {/* Legend / hint */}
      {!readOnly && (
        <div className="mt-3 pt-2 border-t text-[11px] text-muted-foreground text-center">
          주를 클릭하면 해당 주의 데이터를 볼 수 있습니다
        </div>
      )}
    </div>
  );
}
