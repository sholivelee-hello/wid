'use client';

import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import {
  useCalendarViewState,
  setCalendarVisible,
  setCalendarColor,
} from '@/lib/calendar-view-state';

const COLOR_PALETTE = [
  '#6366F1', '#14B8A6', '#F59E0B', '#8B5CF6',
  '#10B981', '#F43F5E', '#06B6D4', '#64748B',
];

export function CalendarSubscriptions() {
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const viewState = useCalendarViewState(subs);

  useEffect(() => {
    apiFetch<CalendarSubscription[]>('/api/gcal/calendars', { suppressToast: true })
      .then(setSubs)
      .catch(() => setSubs([]));
  }, []);

  if (subs.length === 0) return null;

  return (
    <div className="px-2 py-3 space-y-1">
      <div className="px-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        내 캘린더
      </div>
      <div className="max-h-[240px] overflow-y-auto space-y-0.5">
        {subs.map((sub) => {
          const entry = viewState[sub.id];
          const visible = entry?.visible ?? true;
          const color = entry?.color ?? sub.defaultColor;
          return (
            <div
              key={sub.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
                'hover:bg-sidebar-accent/50 cursor-pointer'
              )}
              onClick={() => setCalendarVisible(sub.id, !visible)}
              role="checkbox"
              aria-checked={visible}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setCalendarVisible(sub.id, !visible);
                }
              }}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={() => setCalendarVisible(sub.id, !visible)}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                aria-label={`${sub.name} 표시`}
              />
              <Popover>
                <PopoverTrigger
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${sub.name} 색상 변경`}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: visible ? color : 'transparent',
                      border: visible ? 'none' : `1.5px solid ${color}`,
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCalendarColor(sub.id, c)}
                        className={cn(
                          'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                          c === color ? 'ring-2 ring-offset-2 ring-foreground' : 'border-border'
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`색상 ${c}`}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <span className={cn(
                'flex-1 text-sm truncate',
                !visible && 'text-muted-foreground line-through'
              )}>
                {sub.name}
                {sub.role && (
                  <span className="ml-1 text-xs text-muted-foreground/70">
                    {sub.role}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
