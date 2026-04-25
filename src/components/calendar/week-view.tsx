'use client';

import { useMemo, useState, useEffect } from 'react';
import { format, eachDayOfInterval, endOfWeek, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';
import type { GCalEvent } from '@/lib/mock-gcal';

interface WeekTimeGridProps {
  weekStart: Date;
  events: GCalEvent[];
}

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_PX;
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface EventLayout {
  laneIndex: number;
  totalLanes: number;
}

/** 같은 날 timed 이벤트들의 레인 레이아웃 계산:
 *  시간이 겹치는 이벤트들끼리만 레인 분할, 겹치지 않으면 totalLanes=1
 */
function computeLayout(
  evs: Array<{ id: string; startMin: number; endMin: number }>
): Map<string, EventLayout> {
  const n = evs.length;
  const result = new Map<string, EventLayout>();
  if (n === 0) return result;

  // Build adjacency: overlaps[i] = set of j indices that overlap with i
  const overlapsAdj: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (evs[i].startMin < evs[j].endMin && evs[j].startMin < evs[i].endMin) {
        overlapsAdj[i].add(j);
        overlapsAdj[j].add(i);
      }
    }
  }

  // Union-Find to get connected components (overlap groups)
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  for (let i = 0; i < n; i++) {
    for (const j of overlapsAdj[i]) {
      const pi = find(i), pj = find(j);
      if (pi !== pj) parent[pi] = pj;
    }
  }

  // Group by component
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Assign lanes within each group
  for (const members of groups.values()) {
    const totalLanes = members.length;
    members.forEach((idx, laneIdx) => {
      result.set(evs[idx].id, { laneIndex: laneIdx, totalLanes });
    });
  }
  return result;
}

interface TooltipInfo {
  event: GCalEvent;
  calName: string;
  color: string;
  x: number;
  y: number;
}

export function WeekView({ weekStart, events }: WeekTimeGridProps) {
  const viewState = useCalendarViewState(MOCK_CALENDARS);
  const [clickedEvent, setClickedEvent] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClickedEvent(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });

  const timedEventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    for (const ev of events) {
      if (viewState[ev.calendarId]?.visible === false || !ev.time) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events, viewState]);

  const allDayEventsByDate = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    for (const ev of events) {
      if (viewState[ev.calendarId]?.visible === false || ev.time) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events, viewState]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-y-auto" style={{ maxHeight: '660px' }}>
      {/* Day headers */}
      <div className="sticky top-0 z-20 grid border-b bg-card" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
        <div className="border-r bg-muted/20" />
        {days.map((day, i) => {
          const today = isToday(day);
          const isWeekend = i === 5 || i === 6;
          return (
            <div key={i} className={cn(
              'px-2 py-2.5 text-center border-r last:border-r-0',
              isWeekend && 'bg-muted/20',
              today && 'bg-primary/8'
            )}>
              <div className={cn(
                'text-[11px] font-medium mb-1',
                i === 5 && 'text-blue-400',
                i === 6 && 'text-red-400',
                !isWeekend && 'text-muted-foreground'
              )}>{WEEKDAY_LABELS[i]}</div>
              <div className={cn(
                'inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold mx-auto',
                today && 'bg-primary text-primary-foreground'
              )}>{format(day, 'd')}</div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {days.some(d => allDayEventsByDate.has(format(d, 'yyyy-MM-dd'))) && (
        <div className="grid border-b" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
          <div className="border-r bg-muted/20 flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>종일</span>
          </div>
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvs = allDayEventsByDate.get(dateStr) ?? [];
            return (
              <div key={dateStr} className={cn('border-r last:border-r-0 p-1 min-h-[28px] space-y-0.5', i >= 5 && 'bg-muted/10')}>
                {dayEvs.map(ev => {
                  const color = viewState[ev.calendarId]?.color ?? '#6366F1';
                  return (
                    <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate"
                      style={{ backgroundColor: `${color}25`, color }} title={ev.title}>
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
        {/* Time labels column */}
        <div className="border-r bg-muted/10 relative" style={{ height: TOTAL_HEIGHT }}>
          {HOURS.map((h, i) => (
            <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
              style={{ top: i * HOUR_PX, height: HOUR_PX }}>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                {String(h).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayEvents = timedEventsByDate.get(dateStr) ?? [];
          const today = isToday(day);
          const isWeekend = di === 5 || di === 6;

          // Compute layout for this day's events
          const layoutInput = dayEvents.map(ev => ({
            id: ev.id,
            startMin: parseMinutes(ev.time!),
            endMin: ev.endTime ? parseMinutes(ev.endTime) : parseMinutes(ev.time!) + 30,
          }));
          const layoutMap = computeLayout(layoutInput);

          return (
            <div key={dateStr}
              className={cn('relative border-r last:border-r-0', isWeekend && 'bg-muted/5', today && 'bg-primary/3')}
              style={{ height: TOTAL_HEIGHT }}
            >
              {/* Hour grid lines */}
              {HOURS.map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-border/25"
                  style={{ top: i * HOUR_PX }} />
              ))}

              {/* Events */}
              {dayEvents.map(ev => {
                const startMin = parseMinutes(ev.time!);
                const endMin = ev.endTime ? parseMinutes(ev.endTime) : startMin + 30;
                if (startMin / 60 < START_HOUR || startMin / 60 >= END_HOUR) return null;

                const top = (startMin / 60 - START_HOUR) * HOUR_PX;
                const height = Math.max(20, Math.min(
                  ((endMin - startMin) / 60) * HOUR_PX - 2,
                  TOTAL_HEIGHT - top - 2
                ));

                const layout = layoutMap.get(ev.id) ?? { laneIndex: 0, totalLanes: 1 };
                const leftPct = (layout.laneIndex / layout.totalLanes) * 100;
                const widthPct = (1 / layout.totalLanes) * 100;

                const color = viewState[ev.calendarId]?.color ?? '#6366F1';
                const cal = MOCK_CALENDARS.find(c => c.id === ev.calendarId);

                return (
                  <div
                    key={ev.id}
                    className="absolute rounded px-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90 hover:z-10"
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                      backgroundColor: `${color}28`,
                      borderLeft: `3px solid ${color}`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setClickedEvent({
                        event: ev,
                        calName: cal?.name ?? ev.calendarId,
                        color,
                        x: rect.right + 8,
                        y: rect.top,
                      });
                    }}
                  >
                    <div className="text-[10px] font-semibold leading-tight truncate pt-0.5" style={{ color }}>
                      {ev.title}
                    </div>
                    {height > 36 && (
                      <div className="text-[9px] font-mono tabular-nums opacity-70" style={{ color }}>
                        {ev.time}–{ev.endTime ?? ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>{/* end overflow-y-auto */}

      {/* Click popover */}
      {clickedEvent && (
        <>
          {/* Transparent backdrop — click outside to close */}
          <div className="fixed inset-0 z-40" onClick={() => setClickedEvent(null)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-4 w-72"
            style={{
              left: Math.min(clickedEvent.x, window.innerWidth - 296),
              top: Math.max(8, Math.min(clickedEvent.y, window.innerHeight - 240)),
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: clickedEvent.color }} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-snug">{clickedEvent.event.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{clickedEvent.calName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClickedEvent(null)}
                className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Time */}
            {(clickedEvent.event.time || clickedEvent.event.endTime) && (
              <div className="text-xs text-muted-foreground mb-2 font-mono flex items-center gap-1.5">
                <span>🕐</span>
                {clickedEvent.event.time}{clickedEvent.event.endTime ? ` – ${clickedEvent.event.endTime}` : ''}
              </div>
            )}

            {/* Location */}
            {clickedEvent.event.location && (
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <span>📍</span> {clickedEvent.event.location}
              </div>
            )}

            {/* Attendees */}
            {clickedEvent.event.attendees && clickedEvent.event.attendees.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                <span className="font-medium text-foreground/70">참여자</span>{' '}
                {clickedEvent.event.attendees.join(', ')}
              </div>
            )}

            {/* Meet link */}
            {clickedEvent.event.meetLink && (
              <a
                href={clickedEvent.event.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs text-primary hover:underline flex items-center gap-1.5"
              >
                <span>🎥</span> Google Meet 참가
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
