'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, format, isSameMonth, isToday,
  isWithinInterval,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MiniMonthPickerProps {
  selectedWeekStart: Date;
  monthCursor: Date;
  onMonthChange: (d: Date) => void;
  onWeekSelect: (weekStart: Date) => void;
  eventDates?: Set<string>;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function MiniMonthPicker({
  selectedWeekStart,
  monthCursor,
  onMonthChange,
  onWeekSelect,
  eventDates,
}: MiniMonthPickerProps) {
  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const selectedWeekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onMonthChange(addMonths(monthCursor, -1))} aria-label="이전 달">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-semibold">
          {format(monthCursor, 'yyyy년 M월', { locale: ko })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onMonthChange(addMonths(monthCursor, 1))} aria-label="다음 달">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={cn(
            'text-center text-[10px] font-medium text-muted-foreground py-0.5',
            i === 5 && 'text-blue-500',
            i === 6 && 'text-red-500'
          )}>
            {wd}
          </div>
        ))}
      </div>

      <div className="space-y-0.5">
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const isSelectedWeek = isWithinInterval(weekStart, {
            start: selectedWeekStart,
            end: selectedWeekEnd,
          });

          return (
            <div
              key={wi}
              role="button"
              tabIndex={0}
              onClick={() => onWeekSelect(weekStart)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWeekSelect(weekStart); }
              }}
              className={cn(
                'grid grid-cols-7 rounded cursor-pointer transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                isSelectedWeek ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-accent/50'
              )}
              aria-pressed={isSelectedWeek}
            >
              {week.map((day, di) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, monthCursor);
                const today = isToday(day);
                const hasEvents = eventDates?.has(dateStr);

                return (
                  <div key={dateStr} className="flex flex-col items-center py-1 gap-0.5">
                    <span className={cn(
                      'inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-medium tabular-nums',
                      today && 'bg-primary text-primary-foreground',
                      !today && !isCurrentMonth && 'text-muted-foreground/30',
                      !today && isCurrentMonth && di === 6 && 'text-red-500',
                      !today && isCurrentMonth && di === 5 && 'text-blue-500',
                    )}>
                      {format(day, 'd')}
                    </span>
                    <span className={cn(
                      'h-1 w-1 rounded-full',
                      hasEvents ? 'bg-primary/50' : 'bg-transparent'
                    )} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
