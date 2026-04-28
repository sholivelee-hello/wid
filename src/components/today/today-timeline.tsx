'use client';

import { useMemo } from 'react';
import { useCalendarViewState } from '@/lib/calendar-view-state';

import type { GCalEvent } from '@/lib/types';

interface TodayTimelineProps {
  events: GCalEvent[];
}

const HOUR_PIXELS = 48;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const DEFAULT_EVENT_DURATION_MIN = 30;

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function TodayTimeline({ events }: TodayTimelineProps) {
  const viewState = useCalendarViewState([]);

  const { timed, allDay } = useMemo(() => {
    const visible = events.filter(e => viewState[e.calendarId]?.visible !== false);
    return {
      timed: visible.filter(e => e.time),
      allDay: visible.filter(e => !e.time),
    };
  }, [events, viewState]);

  const { startHour, endHour } = useMemo(() => {
    let s = DEFAULT_START_HOUR;
    let e = DEFAULT_END_HOUR;
    for (const ev of timed) {
      const startMin = parseTime(ev.time!);
      const endMin = ev.endTime ? parseTime(ev.endTime) : startMin + DEFAULT_EVENT_DURATION_MIN;
      s = Math.min(s, Math.floor(startMin / 60));
      e = Math.max(e, Math.ceil(endMin / 60));
    }
    return { startHour: s, endHour: e };
  }, [timed]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * HOUR_PIXELS;

  if (timed.length === 0 && allDay.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        오늘 예정된 일정이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allDay.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-2 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">종일</p>
          {allDay.map(ev => {
            const color = viewState[ev.calendarId]?.color ?? '#6366F1';
            return (
              <div
                key={ev.id}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: `${color}1A`, borderLeft: `3px solid ${color}`, color }}
              >
                {ev.title}
              </div>
            );
          })}
        </div>
      )}

      <div className="relative border rounded-md bg-background" style={{ height: totalHeight }}>
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/40 flex"
            style={{ top: i * HOUR_PIXELS, height: HOUR_PIXELS }}
          >
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums pl-2 pt-0.5 w-12 select-none">
              {String(h).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        {timed.map(ev => {
          const startMin = parseTime(ev.time!);
          const endMin = ev.endTime ? parseTime(ev.endTime) : startMin + DEFAULT_EVENT_DURATION_MIN;
          const top = ((startMin / 60) - startHour) * HOUR_PIXELS;
          const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_PIXELS);
          const color = viewState[ev.calendarId]?.color ?? '#6366F1';
          const owner = '';
          return (
            <div
              key={ev.id}
              className="absolute left-14 right-2 rounded-md px-2 py-1 overflow-hidden"
              style={{
                top,
                height: height - 2,
                backgroundColor: `${color}1A`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div className="text-xs font-mono tabular-nums text-muted-foreground">
                {ev.time}{ev.endTime && ` – ${ev.endTime}`}
              </div>
              <div className="text-sm font-medium truncate" style={{ color }}>
                {ev.title}
              </div>
              {owner && ev.calendarId !== 'me' && (
                <div className="text-[11px] text-muted-foreground truncate">{owner}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
