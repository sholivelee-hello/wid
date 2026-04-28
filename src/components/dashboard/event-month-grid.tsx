'use client';

import { useMemo, useState, useEffect } from 'react';
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
  getWeekOfMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GCalEvent } from '@/lib/types';
import { useCalendarViewState } from '@/lib/calendar-view-state';

import { getCalendarColor, getGCalConfig, GCAL_EMBED_EVENT, type GCalConfig } from '@/lib/gcal-embed';

interface EventMonthGridProps {
  selectedDate: Date;
  monthCursor: Date;
  onMonthChange: (d: Date) => void;
  onWeekSelect: (d: Date) => void;
  onDaySelect?: (d: Date) => void;
  events: GCalEvent[];
  completedCountByDate?: Map<string, number>;
  searchHighlightDates?: Set<string>;
  readOnly?: boolean;
  /** Optional today date string (yyyy-MM-dd). Defaults to today via date-fns isToday. */
  today?: string;
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
  today: todayProp,
}: EventMonthGridProps) {
  const viewState = useCalendarViewState([]);

  const [gcalConfig, setGcalConfig] = useState<GCalConfig>(() => getGCalConfig());
  useEffect(() => {
    const update = () => setGcalConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, update);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, update);
  }, []);

  const visibleEvents = useMemo(
    () => events.filter(ev => viewState[ev.calendarId]?.visible !== false),
    [events, viewState]
  );

  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      out.push(days.slice(i, i + 7));
    }
    return out;
  }, [days]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    visibleEvents.forEach(ev => {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    });
    map.forEach(list => list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')));
    return map;
  }, [visibleEvents]);

  const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  return (
    <div className="w-full select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onMonthChange(addMonths(monthCursor, -1))} aria-label="이전 달">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold tracking-[-0.018em]">
          {format(monthCursor, 'yyyy년 M월', { locale: ko })}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onMonthChange(addMonths(monthCursor, 1))} aria-label="다음 달">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday header — 8-col grid: [week-handle | mon..sun] */}
      <div className="grid grid-cols-[32px_repeat(7,1fr)] gap-px mb-1">
        <div aria-hidden="true" />
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={cn(
            'text-center text-[11px] font-medium text-muted-foreground py-1',
            i === 5 && 'text-blue-500',
            i === 6 && 'text-red-500'
          )}>
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

          const weekCells = week.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const isCurrentMonth = isSameMonth(day, monthCursor);
            const today = todayProp ? dateStr === todayProp : isToday(day);
            const isSelectedDay = format(selectedDate, 'yyyy-MM-dd') === dateStr;

            const completedCount = completedCountByDate?.get(dateStr);
            const dayCellContent = (
              <>
                {/* Date number — top-left, on its own row */}
                <div className="mb-1 flex-shrink-0">
                  <span className={cn(
                    'inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-medium tabular-nums',
                    // selected solid bg wins; when today AND selected, also keep a subtle inner ring so today still reads
                    isSelectedDay && 'bg-primary text-primary-foreground',
                    isSelectedDay && today && 'ring-1 ring-primary-foreground/70 ring-inset',
                    !isSelectedDay && today && 'font-bold text-primary',
                    !isSelectedDay && !today && isCurrentMonth && 'text-foreground',
                    !isSelectedDay && !today && !isCurrentMonth && 'text-muted-foreground/60'
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events (max 3) — title only; time lives in the right detail panel. */}
                <div className="space-y-0.5 w-full min-w-0">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const evColor = viewState[ev.calendarId]?.color ?? getCalendarColor(ev.calendarId, gcalConfig);
                    return (
                      <div
                        key={ev.id}
                        style={{ backgroundColor: `${evColor}1A`, color: evColor, borderLeft: `2px solid ${evColor}` }}
                        className="text-[10px] leading-tight rounded px-1 py-0.5 font-medium truncate"
                        title={`${ev.time ?? ''} ${ev.title}${ev.location ? ` · ${ev.location}` : ''}`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </>
            );

            const isSearchHit = !!searchHighlightDates?.has(dateStr);
            // Visual signal priority: search hit > today/selected.
            //   - search hit: dashed primary border (highest), today/selected ring fades via primaryAlpha
            //   - today: inset primary box-shadow
            //   - selected: outer primary box-shadow with 1px breathing gap
            //   - today + selected: both stack (inset + outer) with breathing gap
            // When search hits, build ring with reduced alpha so primary dashed dominates the cell edge.
            const ringFade = isSearchHit ? 18 : 60; // primary alpha % (oklab)
            const primaryAlpha = `color-mix(in oklab, var(--primary) ${ringFade}%, transparent)`;
            const primarySolid = isSearchHit
              ? 'color-mix(in oklab, var(--primary) 30%, transparent)'
              : 'var(--primary)';
            let boxShadow: string | undefined;
            if (today && isSelectedDay) {
              boxShadow = `inset 0 0 0 2px ${primaryAlpha}, 0 0 0 2px ${primarySolid}, 0 0 0 3px var(--background)`;
            } else if (today) {
              boxShadow = `inset 0 0 0 2px ${primaryAlpha}`;
            } else if (isSelectedDay) {
              boxShadow = `0 0 0 2px ${primarySolid}, 0 0 0 3px var(--background)`;
            }
            return (
              <div
                key={dateStr}
                style={boxShadow ? { boxShadow } : undefined}
                className={cn(
                  // Fixed cell height so the calendar grid stays a true grid —
                  // long titles or event-heavy days no longer push their row taller.
                  'h-[96px] overflow-hidden rounded-md border p-1.5 text-left transition-colors relative',
                  // search match uses a separate visual channel: dashed primary border (highest priority)
                  isSearchHit ? 'border-2 border-dashed border-primary/70' : 'border border-transparent',
                  isCurrentMonth ? 'bg-background' : 'bg-muted/20'
                )}
              >
                {onDaySelect ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDaySelect(day); }}
                    className={cn(
                      'w-full h-full text-left flex flex-col items-start justify-start rounded-sm transition-colors cursor-pointer overflow-hidden',
                      'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
                    )}
                    aria-label={`${format(day, 'M월 d일', { locale: ko })} 일별 보기`}
                  >
                    {dayCellContent}
                  </button>
                ) : (
                  <>{dayCellContent}</>
                )}
                {/* Top-right absolute slot: 오늘 tag or completion count.
                    Pulled out of the date-row to avoid wrap/overflow on narrow cells. */}
                {(today || completedCount) ? (
                  <span
                    className={cn(
                      'absolute top-1 right-1.5 text-[9px] font-semibold leading-none tabular-nums pointer-events-none',
                      today ? 'text-primary' : 'text-primary/70'
                    )}
                  >
                    {today && completedCount
                      ? `오늘 · ${completedCount}`
                      : today
                        ? '오늘'
                        : `● ${completedCount}`}
                  </span>
                ) : null}
              </div>
            );
          });

          // Week-handle button — replaces the prior whole-row click target.
          // 8-col grid keeps day cells in their own click lane.
          const weekLabel = `${format(weekStart, 'M월 d일', { locale: ko })} ~ ${format(week[6], 'M월 d일', { locale: ko })}`;
          const weekHandle = readOnly ? (
            <div aria-hidden="true" />
          ) : (
            <button
              type="button"
              onClick={() => onWeekSelect(weekStart)}
              aria-label={`${weekLabel} 주 선택`}
              aria-pressed={isSelectedWeek}
              className={cn(
                'flex items-center justify-center rounded text-[10px] tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelectedWeek
                  ? 'text-primary font-semibold bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {getWeekOfMonth(weekStart, { weekStartsOn: 1 })}주
            </button>
          );

          return (
            <div
              key={wi}
              className={cn(
                'grid grid-cols-[32px_repeat(7,1fr)] gap-px w-full rounded-md p-0.5 transition-colors',
                isSelectedWeek && !readOnly && 'bg-primary/5 ring-1 ring-primary/30'
              )}
            >
              {weekHandle}
              {weekCells}
            </div>
          );
        })}
      </div>

    </div>
  );
}
