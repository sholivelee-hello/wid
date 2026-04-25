# WID v2 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign WID from a time-axis analytics app into a task inbox with archival calendar+search, adding multi-calendar subscription support with per-calendar color/visibility toggles.

**Architecture:** Keep the existing Next.js 16+ App Router + shadcn/ui v4 + Tailwind v4 stack. Introduce a new `/history` route replacing `/weekly` and `/monthly`. Sidebar gains a calendar subscription panel. Data fetching stays client-side filtered. Calendar visibility/color state persists in localStorage.

**Tech Stack:** Next.js 16+, shadcn/ui v4 (base-ui), Tailwind CSS v4, date-fns, Zustand (existing), localStorage.

**Spec:** `docs/superpowers/specs/2026-04-15-wid-v2-redesign.md`

---

## File Structure

### New files
```
src/
├── app/
│   ├── history/
│   │   └── page.tsx                         # History page (calendar + search)
│   └── api/
│       ├── gcal/
│       │   └── calendars/
│       │       └── route.ts                 # GET subscribed calendars
│       └── time-logs/
│           └── route.ts                     # GET time_logs for date range
├── components/
│   ├── history/
│   │   ├── day-detail-panel.tsx             # Right panel: events + completed + worked
│   │   └── search-results.tsx               # Grouped search result list
│   ├── today/
│   │   └── today-timeline.tsx               # Visual day-view timeline
│   └── layout/
│       └── calendar-subscriptions.tsx       # Sidebar checkbox list + color picker
└── lib/
    ├── calendar-view-state.ts               # Hooks for visibility + color (localStorage)
    ├── mock-calendars.ts                    # Mock subscription list (5 calendars)
    └── search.ts                            # Relevance scoring
```

### Modified files
```
src/
├── app/
│   ├── today/page.tsx                       # Rewrite: timeline + filtered task list
│   └── api/gcal/events/route.ts             # Return events with calendarId + endTime
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                      # Render CalendarSubscriptions
│   │   └── header.tsx                       # Page titles for /history
│   └── dashboard/
│       └── event-month-grid.tsx             # Per-calendar color + day-click + count badge
├── lib/
│   ├── nav-items.ts                         # Remove weekly/monthly, add history
│   ├── mock-gcal.ts                         # Add calendarId + endTime
│   └── types.ts                             # Remove WeeklyStats/MonthlyStats
└── next.config.ts                           # Add redirects
```

### Deleted files
```
src/
├── app/
│   ├── weekly/                              # Entire directory
│   └── monthly/                             # Entire directory
└── components/dashboard/
    ├── week-picker.tsx
    ├── heatmap-calendar.tsx
    ├── priority-pie-chart.tsx
    ├── source-pie-chart.tsx
    ├── duration-bar-chart.tsx
    ├── trend-line-chart.tsx
    ├── status-bar-chart.tsx
    ├── timeline-chart.tsx
    └── summary-cards.tsx
```

---

## Phase 1: Data Model + New APIs

### Task 1: Extend GCalEvent + Create Mock Calendars

**Files:**
- Modify: `src/lib/mock-gcal.ts`
- Create: `src/lib/mock-calendars.ts`

- [ ] **Step 1: Update GCalEvent interface**

Edit `src/lib/mock-gcal.ts`. Change the `GCalEvent` interface:

```typescript
export interface GCalEvent {
  id: string;
  calendarId: string;     // NEW
  title: string;
  date: string;           // YYYY-MM-DD
  time?: string;          // HH:MM (start)
  endTime?: string;       // NEW — HH:MM (end)
  location?: string;
}
```

- [ ] **Step 2: Redistribute 11 mock events across 5 calendars + add endTimes**

Update each event in `MOCK_GCAL_EVENTS`. Distribute:
- `g1` (스프린트 플래닝) → `kim_minji`, endTime `'11:00'`
- `g2` (디자인 리뷰) → `jeong_hayoon`, endTime `'15:00'`
- `g3` (1:1 미팅 팀장) → `me`, endTime `'11:30'`
- `g4` (제품 데모) → `me`, endTime `'16:30'`
- `g5` (분기 OKR 회의) → `park_sejun`, endTime `'11:00'`
- `g6` (고객사 방문) → `me`, endTime `'17:00'`
- `g7` (팀 회식) → `me`, endTime `'21:00'`
- `g8` (전사 타운홀) → `me`, endTime `'17:30'`
- `g9` (코드 리뷰 세션) → `park_sejun`, endTime `'12:00'`
- `g10` (파트너 미팅) → `me`, endTime `'15:30'`
- `g11` (보안 교육) → `choi_yujin`, endTime `'11:00'`

- [ ] **Step 3: Create mock-calendars.ts**

Create `src/lib/mock-calendars.ts`:

```typescript
export interface CalendarSubscription {
  id: string;
  name: string;
  role?: string;
  defaultColor: string;
}

export const MOCK_CALENDARS: CalendarSubscription[] = [
  { id: 'me',           name: '내 캘린더', defaultColor: '#6366F1' },
  { id: 'kim_minji',    name: '김민지', role: '디자인', defaultColor: '#14B8A6' },
  { id: 'park_sejun',   name: '박서준', role: '백엔드', defaultColor: '#F59E0B' },
  { id: 'jeong_hayoon', name: '정하윤', role: 'PM', defaultColor: '#8B5CF6' },
  { id: 'choi_yujin',   name: '최유진', role: '프론트', defaultColor: '#10B981' },
];
```

- [ ] **Step 4: Update events API to return new fields**

Edit `src/app/api/gcal/events/route.ts`. The route currently returns events as-is from mock. After adding fields, verify they're returned. No code change needed if the route spreads the objects.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles with 0 errors. All existing pages still work (no callers use `calendarId`/`endTime` yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock-gcal.ts src/lib/mock-calendars.ts
git commit -m "feat: extend GCalEvent with calendarId and endTime; add mock calendar subscriptions"
```

---

### Task 2: /api/gcal/calendars Endpoint

**Files:**
- Create: `src/app/api/gcal/calendars/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';

export async function GET() {
  // TODO: real Google Calendar API integration when OAuth set up
  return NextResponse.json(MOCK_CALENDARS);
}
```

- [ ] **Step 2: Verify via curl**

Run dev server: `npm run dev` (use port 4000: `npx next dev -p 4000`)
Test: `curl http://localhost:4000/api/gcal/calendars`
Expected: JSON array of 5 calendars.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gcal/calendars
git commit -m "feat: add /api/gcal/calendars endpoint"
```

---

### Task 2.5: Extend /api/tasks to Filter by completed_at OR created_at

**Files:**
- Modify: `src/app/api/tasks/route.ts`

**Why:** History page needs tasks whose `completed_at` OR `created_at` falls in the month range. A task created in March but completed in April should appear in April's history. Current API filters only by `created_at`, causing silent data loss.

- [ ] **Step 1: Add a `dateField` query parameter with OR semantics**

Edit `src/app/api/tasks/route.ts`. After extracting query params, change the date-filtering logic. For mock mode:

```typescript
const from = searchParams.get('from');
const to = searchParams.get('to');
const dateField = searchParams.get('dateField'); // 'created_at' (default) | 'either'

// filter with either-OR semantics when requested
if (from || to) {
  tasks = tasks.filter((t) => {
    const inRange = (iso: string | null | undefined) => {
      if (!iso) return false;
      if (from && iso < from) return false;
      if (to && iso > `${to}T23:59:59.999Z`) return false;
      return true;
    };
    if (dateField === 'either') {
      return inRange(t.created_at) || inRange(t.completed_at);
    }
    // default: created_at only (backward compatible)
    return inRange(t.created_at);
  });
}
```

For the Supabase path, build a compound `.or()` filter when `dateField === 'either'`:
```typescript
if (dateField === 'either' && from && to) {
  query = query.or(
    `and(created_at.gte.${from},created_at.lte.${to}T23:59:59.999Z),and(completed_at.gte.${from},completed_at.lte.${to}T23:59:59.999Z)`
  );
} else {
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);
}
```

- [ ] **Step 2: Verify with curl**

```bash
# Default (created_at only) — should be backward-compatible
curl "http://localhost:4000/api/tasks?from=2026-04-01&to=2026-04-30"

# New either-mode — should include tasks completed in April even if created earlier
curl "http://localhost:4000/api/tasks?from=2026-04-01&to=2026-04-30&dateField=either"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: /api/tasks supports dateField=either for completed_at OR created_at filtering"
```

**Note:** The History page (Task 10) will pass `&dateField=either` to capture tasks completed in the visible month regardless of creation date.

---

### Task 3: /api/time-logs Endpoint

**Files:**
- Create: `src/app/api/time-logs/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from'); // YYYY-MM-DD
  const to = sp.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  if (isMockMode()) {
    const filtered = MOCK_TIMELOGS.filter(log => {
      return log.started_at >= fromIso && log.started_at <= toIso;
    });
    return NextResponse.json(filtered);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .gte('started_at', fromIso)
    .lte('started_at', toIso);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 2: Test**

Test: `curl "http://localhost:4000/api/time-logs?from=2026-04-01&to=2026-04-30"`
Expected: JSON array of time logs in April.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/time-logs
git commit -m "feat: add /api/time-logs endpoint for date-range queries"
```

---

## Phase 2: Calendar View State + Sidebar

### Task 4: Calendar View State Library

**Files:**
- Create: `src/lib/calendar-view-state.ts`

- [ ] **Step 1: Write the library**

Follow the `src/lib/hidden-statuses.ts` pattern exactly.

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { CalendarSubscription } from './mock-calendars';

const STORAGE_KEY = 'wid-calendar-view-state';
const EVENT_NAME = 'calendar-view-state-changed';

export interface CalendarViewEntry {
  visible: boolean;
  color: string;
}
export type CalendarViewState = Record<string, CalendarViewEntry>;

function readState(): CalendarViewState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeState(state: CalendarViewState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function setCalendarVisible(id: string, visible: boolean): void {
  const state = readState();
  state[id] = { ...state[id], visible, color: state[id]?.color ?? '' };
  writeState(state);
}

export function setCalendarColor(id: string, color: string): void {
  const state = readState();
  state[id] = { visible: state[id]?.visible ?? true, color };
  writeState(state);
}

/** Merge stored state with defaults from subscriptions. */
function mergeWithDefaults(
  state: CalendarViewState,
  subscriptions: CalendarSubscription[]
): CalendarViewState {
  const merged: CalendarViewState = {};
  for (const sub of subscriptions) {
    merged[sub.id] = {
      visible: state[sub.id]?.visible ?? true,
      color: state[sub.id]?.color || sub.defaultColor,
    };
  }
  return merged;
}

export function useCalendarViewState(
  subscriptions: CalendarSubscription[]
): CalendarViewState {
  const [state, setState] = useState<CalendarViewState>(() =>
    mergeWithDefaults(readState(), subscriptions)
  );

  useEffect(() => {
    const update = () => setState(mergeWithDefaults(readState(), subscriptions));
    update();
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [subscriptions]);

  return state;
}

export function useCalendarVisible(id: string): boolean {
  const [visible, setVisible] = useState<boolean>(() => readState()[id]?.visible ?? true);
  useEffect(() => {
    const update = () => setVisible(readState()[id]?.visible ?? true);
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [id]);
  return visible;
}

export function useCalendarColor(
  id: string,
  subscriptions: CalendarSubscription[]
): string {
  const [color, setColor] = useState<string>(() => {
    const sub = subscriptions.find(s => s.id === id);
    return readState()[id]?.color || sub?.defaultColor || '#6B7280';
  });
  useEffect(() => {
    const update = () => {
      const sub = subscriptions.find(s => s.id === id);
      setColor(readState()[id]?.color || sub?.defaultColor || '#6B7280');
    };
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [id, subscriptions]);
  return color;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar-view-state.ts
git commit -m "feat: add calendar view state hooks with localStorage persistence"
```

---

### Task 5: Calendar Subscriptions Sidebar Panel

**Files:**
- Create: `src/components/layout/calendar-subscriptions.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Integrate into sidebar**

Edit `src/components/layout/sidebar.tsx`. Import `CalendarSubscriptions`:
```tsx
import { CalendarSubscriptions } from './calendar-subscriptions';
```

Add it after the nav items section but before the collapse toggle. Only render when sidebar is NOT collapsed:
```tsx
{!collapsed && (
  <div className="border-t border-sidebar-border mt-2 pt-1">
    <CalendarSubscriptions />
  </div>
)}
```

- [ ] **Step 3: Integrate into mobile Sheet nav**

Edit `src/components/layout/header.tsx`.

Add import at top alongside existing imports:
```tsx
import { CalendarSubscriptions } from './calendar-subscriptions';
```

Find the mobile Sheet content block (look for `<SheetContent side="left">` or similar). **Immediately AFTER the closing `</nav>` tag and BEFORE the closing `</SheetContent>`**, insert:
```tsx
<div className="border-t pt-2 mt-2">
  <CalendarSubscriptions />
</div>
```

This keeps the nav items inside `<nav>` for proper a11y semantics while adding the subscription panel as a sibling sidebar section.

- [ ] **Step 4: Build + visually verify in browser**

Run: `npm run build`
Expected: 0 errors.
Manual: start dev server, verify sidebar shows 5 calendars with checkboxes. Click a checkbox - row dims. Click color dot - palette popover opens. Pick a color - dot updates.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/calendar-subscriptions.tsx src/components/layout/sidebar.tsx src/components/layout/header.tsx
git commit -m "feat: add calendar subscriptions sidebar panel with visibility + color"
```

---

## Phase 3: EventMonthGrid Enhancement

### Task 6: EventMonthGrid - Per-Calendar Color + Day Click + Count Badge

**Files:**
- Modify: `src/components/dashboard/event-month-grid.tsx`

- [ ] **Step 1: Extend props AND loosen width constraint**

Add new props to `EventMonthGridProps`:
```typescript
interface EventMonthGridProps {
  selectedDate: Date;
  monthCursor: Date;
  onMonthChange: (d: Date) => void;
  onWeekSelect: (d: Date) => void;
  onDaySelect?: (d: Date) => void;                  // NEW
  events: GCalEvent[];
  completedCountByDate?: Map<string, number>;       // NEW — 'YYYY-MM-DD' -> count
  searchHighlightDates?: Set<string>;               // NEW — 'YYYY-MM-DD' set for ring highlight
  readOnly?: boolean;
}
```

Also change the outermost wrapper's width from fixed to fluid:
```tsx
// BEFORE:
<div className="w-[640px] max-w-[calc(100vw-2rem)] select-none">

// AFTER:
<div className="w-full max-w-[640px] select-none">
```
This lets the History page shrink it to fit a narrower grid column.

- [ ] **Step 2: Add calendar color resolution**

At the top of the component, import and use `useCalendarViewState`:
```tsx
import { useCalendarViewState } from '@/lib/calendar-view-state';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';

// inside the component:
const viewState = useCalendarViewState(MOCK_CALENDARS);
```

(In a future task we'll fetch subscriptions from the API. For now, use MOCK_CALENDARS directly — this is fine because the API returns the same list.)

Filter events by visibility:
```tsx
const visibleEvents = events.filter(ev => viewState[ev.calendarId]?.visible !== false);
```

- [ ] **Step 3: Use per-calendar color on event pills**

Replace the hardcoded pill style. For each event:
```tsx
const evColor = viewState[ev.calendarId]?.color ?? '#6366F1';
// pill:
<div
  style={{
    backgroundColor: `${evColor}1A`, // 10% alpha
    color: evColor,
    borderLeft: `2px solid ${evColor}`,
  }}
  className="text-[10px] leading-tight rounded px-1 py-0.5 truncate font-medium"
  title={...}
>
  ...
</div>
```

Use `visibleEvents` (not `events`) in the `eventsByDate` Map.

- [ ] **Step 4: Add completed-count badge per cell**

In each day cell, after the day number, add:
```tsx
{completedCountByDate && completedCountByDate.get(dateStr) ? (
  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
    ● {completedCountByDate.get(dateStr)}
  </span>
) : null}
```

- [ ] **Step 4b: Apply search highlight ring**

In the day cell (the outermost container that wraps the date number + events), conditionally add a primary ring when the date is in `searchHighlightDates`:

```tsx
<div
  key={dateStr}
  className={cn(
    'min-h-[76px] rounded-md border border-transparent p-1.5 text-left transition-colors',
    isCurrentMonth ? 'bg-background' : 'bg-muted/20',
    !isCurrentMonth && 'text-muted-foreground/50',
    searchHighlightDates?.has(dateStr) && 'ring-2 ring-primary ring-offset-1'
  )}
>
```

- [ ] **Step 5: Add day-click handler (nested button)**

When `onDaySelect` is provided, wrap the cell contents in a button:
```tsx
onDaySelect ? (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onDaySelect(day);
    }}
    className="w-full h-full text-left rounded-md"
    aria-label={`${format(day, 'M월 d일')} 선택`}
  >
    {/* cell content */}
  </button>
) : (
  {/* cell content */}
)
```

- [ ] **Step 6: Build + verify weekly page still works**

Run: `npm run build`
Manual: `/weekly` still renders (will be deleted in a later task). Week picker popover events now colored per calendar.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/event-month-grid.tsx
git commit -m "feat: EventMonthGrid supports per-calendar color, day-click, completed-count badge"
```

---

## Phase 4: Today Page Rewrite

### Task 7: Today Timeline Component

**Files:**
- Create: `src/components/today/today-timeline.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';
import type { GCalEvent } from '@/lib/mock-gcal';

interface TodayTimelineProps {
  events: GCalEvent[];
}

const HOUR_PIXELS = 48;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const DEFAULT_EVENT_DURATION_MIN = 30;

function parseTime(t: string): number {
  // "HH:MM" -> minutes from midnight
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function TodayTimeline({ events }: TodayTimelineProps) {
  const viewState = useCalendarViewState(MOCK_CALENDARS);

  const { timed, allDay } = useMemo(() => {
    const visible = events.filter(e => viewState[e.calendarId]?.visible !== false);
    return {
      timed: visible.filter(e => e.time),
      allDay: visible.filter(e => !e.time),
    };
  }, [events, viewState]);

  // Compute hour range
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
        {/* Hour grid */}
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

        {/* Events */}
        {timed.map(ev => {
          const startMin = parseTime(ev.time!);
          const endMin = ev.endTime ? parseTime(ev.endTime) : startMin + DEFAULT_EVENT_DURATION_MIN;
          const top = ((startMin / 60) - startHour) * HOUR_PIXELS;
          const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_PIXELS);
          const color = viewState[ev.calendarId]?.color ?? '#6366F1';
          const owner = MOCK_CALENDARS.find(c => c.id === ev.calendarId)?.name ?? '';
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/today/today-timeline.tsx
git commit -m "feat: add Today visual timeline component"
```

---

### Task 8: Today Page Refactor

**Files:**
- Modify: `src/app/today/page.tsx`

- [ ] **Step 1: Rewrite the page**

```tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Task } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { TodayTimeline } from '@/components/today/today-timeline';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, ListTodo } from 'lucide-react';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, eventData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true }),
        apiFetch<GCalEvent[]>(`/api/gcal/events?from=${todayStr}&to=${todayStr}`, { suppressToast: true }),
      ]);
      setTasks(taskData);
      setEvents(eventData);
    } catch {}
    finally { setLoading(false); }
  }, [todayStr]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('task-created', handler);
    window.addEventListener('task-updated', handler);
    return () => {
      window.removeEventListener('task-created', handler);
      window.removeEventListener('task-updated', handler);
    };
  }, [fetchAll]);

  // "오늘 할 task" filter
  // Note: the /api/tasks?deleted=false call already excludes is_deleted tasks
  // (the API treats any value !== 'true' as false for showDeleted).
  const todoTasks = useMemo(() => {
    return tasks.filter(t => {
      if (['완료', '위임', '취소'].includes(t.status)) return false;
      if (t.status === '진행중') return true;
      if (t.deadline && t.deadline.slice(0, 10) <= todayStr) return true;
      if (t.started_at && t.started_at.slice(0, 10) === todayStr) return true;
      return false;
    });
  }, [tasks, todayStr]);

  const completedToday = useMemo(() => {
    return tasks.filter(t =>
      t.status === '완료' && t.completed_at?.startsWith(todayStr)
    );
  }, [tasks, todayStr]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at }
        : t
    ));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('상태가 변경되었습니다');
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch { fetchAll(); }
  };

  const handleComplete = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    await handleStatusChange(taskId, t?.status === '완료' ? '대기' : '완료');
  };

  const handleDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('task가 삭제되었습니다', {
        action: {
          label: '실행 취소',
          onClick: async () => {
            try {
              await apiFetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
              toast.success('복구되었습니다');
              fetchAll();
            } catch {}
          },
        },
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch { fetchAll(); }
  };

  const dateLabel = format(today, 'M월 d일 (EEEE)', { locale: ko });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          ☀️ 오늘, {dateLabel}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          오늘 일정 {events.length}건 · 처리할 task {todoTasks.length}건
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
          🗓️ 오늘의 일정
        </h2>
        {loading ? (
          <div className="h-40 rounded-md bg-muted/30 animate-pulse" />
        ) : (
          <TodayTimeline events={events} />
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
          📋 오늘 할 task
        </h2>
        {loading && todoTasks.length === 0 ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-md bg-muted/30 animate-pulse" />)}
          </div>
        ) : todoTasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="오늘 처리할 task가 없습니다"
            description="새 task를 추가하거나 잠시 쉬세요"
          />
        ) : (
          <div className="space-y-2">
            {todoTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onTimerChange={fetchAll}
                onStatusChange={handleStatusChange}
                onComplete={handleComplete}
                onDelete={(id) => setDeleteId(id)}
                onSelect={setSelectedTaskId}
              />
            ))}
          </div>
        )}
      </section>

      {completedToday.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            aria-expanded={showCompleted}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showCompleted && 'rotate-180')} />
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            오늘 완료 <span className="text-emerald-600 dark:text-emerald-400">({completedToday.length})</span>
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-70">
              {completedToday.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTimerChange={fetchAll}
                  onStatusChange={handleStatusChange}
                  onComplete={handleComplete}
                  onDelete={(id) => setDeleteId(id)}
                  onSelect={setSelectedTaskId}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchAll}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
        confirmLabel="삭제"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 3: Browser verification**

Navigate to `/today`. Verify:
- Header line with counts
- Visual timeline with colored event blocks (test by toggling calendars in sidebar — blocks should appear/disappear)
- "오늘 할 task" list
- "오늘 완료" collapsible (if any completed today)
- Summary cards GONE
- No DateNavigator

- [ ] **Step 4: Commit**

```bash
git add src/app/today/page.tsx
git commit -m "feat: refactor Today page with visual timeline and per-task focus"
```

---

## Phase 5: History Page

### Task 9: Search Library

**Files:**
- Create: `src/lib/search.ts`

- [ ] **Step 1: Write the scoring function**

```typescript
import type { Task } from './types';

export function scoreTask(task: Task, query: string): number {
  if (!query.trim()) return 0;
  const q = query.toLowerCase().trim();

  let score = 0;
  if (task.title?.toLowerCase().includes(q)) score += 100;
  if (task.description?.toLowerCase().includes(q)) score += 50;
  if (task.requester?.toLowerCase().includes(q)) score += 30;
  if (task.delegate_to?.toLowerCase().includes(q)) score += 30;

  // Recency bonus
  const refDateStr = task.completed_at ?? task.created_at;
  if (refDateStr) {
    const refMs = new Date(refDateStr).getTime();
    const days = (Date.now() - refMs) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - Math.min(10, days));
  }

  return score;
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return [];
  return tasks
    .map(t => ({ task: t, score: scoreTask(t, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.task);
}
```

- [ ] **Step 2: Build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/lib/search.ts
git commit -m "feat: add task search with relevance scoring"
```

---

### Task 10: History Page + Day Detail Panel + Search Results

**Files:**
- Create: `src/app/history/page.tsx`
- Create: `src/components/history/day-detail-panel.tsx`
- Create: `src/components/history/search-results.tsx`

- [ ] **Step 1: Create day-detail-panel.tsx**

```tsx
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task, TimeLog } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { cn } from '@/lib/utils';
import { Clock, CalendarDays, CheckCircle2 } from 'lucide-react';

interface DayDetailPanelProps {
  date: Date | null;
  tasks: Task[];
  events: GCalEvent[];
  timeLogs: TimeLog[];
  subscriptions: CalendarSubscription[];
  onTaskClick: (taskId: string) => void;
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function DayDetailPanel({
  date, tasks, events, timeLogs, subscriptions, onTaskClick,
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
      .filter(e => viewState[e.calendarId]?.visible !== false)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events, dateStr, viewState]
  );

  const dayCompleted = useMemo(() =>
    tasks.filter(t => t.completed_at?.startsWith(dateStr)),
    [tasks, dateStr]
  );

  const dayWorked = useMemo(() => {
    const logsByTask = new Map<string, number>();
    for (const log of timeLogs) {
      if (!log.started_at.startsWith(dateStr)) continue;
      if (!log.ended_at) continue;
      const mins = Math.round(
        (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000
      );
      logsByTask.set(log.task_id, (logsByTask.get(log.task_id) ?? 0) + mins);
    }
    return [...logsByTask.entries()]
      .map(([taskId, mins]) => ({
        task: tasks.find(t => t.id === taskId),
        minutes: mins,
      }))
      .filter((x): x is { task: Task; minutes: number } => !!x.task)
      .sort((a, b) => b.minutes - a.minutes);
  }, [timeLogs, tasks, dateStr]);

  const totalEmpty = dayEvents.length === 0 && dayCompleted.length === 0 && dayWorked.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          📌 {dateLabel}
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

          {dayWorked.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3 w-3" /> 작업한 task ({dayWorked.length})
              </h4>
              <div className="space-y-1">
                {dayWorked.map(({ task, minutes }) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors"
                  >
                    <span className="flex-1 text-sm font-medium truncate">{task.title}</span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {minutesToLabel(minutes)}
                    </span>
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
```

- [ ] **Step 2: Create search-results.tsx**

```tsx
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task } from '@/lib/types';
import { searchTasks } from '@/lib/search';

interface SearchResultsProps {
  tasks: Task[];
  query: string;
  onTaskClick: (taskId: string) => void;
}

export function SearchResults({ tasks, query, onTaskClick }: SearchResultsProps) {
  const results = useMemo(() => searchTasks(tasks, query), [tasks, query]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of results) {
      const d = (t.completed_at ?? t.created_at).slice(0, 10);
      const list = map.get(d) ?? [];
      list.push(t);
      map.set(d, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        &apos;{query}&apos;에 대한 결과가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        &apos;{query}&apos; 검색 결과 {results.length}건
      </p>
      {byDate.map(([date, group]) => (
        <section key={date}>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
            {format(new Date(date + 'T00:00:00'), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </h4>
          <div className="space-y-1">
            {group.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTaskClick(t.id)}
                className="w-full text-left px-3 py-2 rounded-md border hover:bg-accent/30 transition-colors"
              >
                <div className="text-sm font-medium">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {t.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create history/page.tsx**

```tsx
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, addMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EventMonthGrid } from '@/components/dashboard/event-month-grid';
import { DayDetailPanel } from '@/components/history/day-detail-panel';
import { SearchResults } from '@/components/history/search-results';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { searchTasks } from '@/lib/search';
import type { Task, TimeLog } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { Search } from 'lucide-react';

export default function HistoryPage() {
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 300);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const fetchAll = useCallback(async () => {
    const from = format(startOfMonth(monthCursor), 'yyyy-MM-dd');
    const to = format(endOfMonth(monthCursor), 'yyyy-MM-dd');
    try {
      const [t, e, l, s] = await Promise.all([
        apiFetch<Task[]>(`/api/tasks?deleted=false&from=${from}&to=${to}&dateField=either`, { suppressToast: true }),
        apiFetch<GCalEvent[]>(`/api/gcal/events?from=${from}&to=${to}`, { suppressToast: true }),
        apiFetch<TimeLog[]>(`/api/time-logs?from=${from}&to=${to}`, { suppressToast: true }),
        apiFetch<CalendarSubscription[]>('/api/gcal/calendars', { suppressToast: true }),
      ]);
      setTasks(t);
      setEvents(e);
      setTimeLogs(l);
      setSubs(s);
    } catch {}
  }, [monthCursor]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Completed count per date for calendar badges
  const completedCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== '완료' || !t.completed_at) continue;
      const d = t.completed_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  // Search matching dates for calendar highlight
  const searchMatchDates = useMemo(() => {
    if (!debouncedSearch) return new Set<string>();
    const matches = searchTasks(tasks, debouncedSearch);
    return new Set(matches.map(t => (t.completed_at ?? t.created_at).slice(0, 10)));
  }, [tasks, debouncedSearch]);

  return (
    <div className="space-y-4 max-w-7xl">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        📅 히스토리
      </h1>

      <div className="relative max-w-lg">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="task 제목/설명/요청자/위임대상 검색..."
          aria-label="task 검색"
          className="pl-8"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <EventMonthGrid
            selectedDate={selectedDate ?? new Date()}
            monthCursor={monthCursor}
            onMonthChange={setMonthCursor}
            onWeekSelect={(d) => setSelectedDate(startOfWeek(d, { weekStartsOn: 1 }))}
            onDaySelect={(d) => {
              if (debouncedSearch) {
                setSearch('');
                setDebouncedSearch('');
              }
              setSelectedDate(d);
            }}
            events={events}
            completedCountByDate={completedCountByDate}
            searchHighlightDates={searchMatchDates}
          />
        </div>

        <div className="border rounded-lg p-4 bg-card min-h-[400px]">
          {debouncedSearch ? (
            <SearchResults
              tasks={tasks}
              query={debouncedSearch}
              onTaskClick={setSelectedTaskId}
            />
          ) : (
            <DayDetailPanel
              date={selectedDate}
              tasks={tasks}
              events={events}
              timeLogs={timeLogs}
              subscriptions={subs}
              onTaskClick={setSelectedTaskId}
            />
          )}
        </div>
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchAll}
      />
    </div>
  );
}
```

- [ ] **Step 4: (Already in Task 6)**

`searchHighlightDates` support was added to `EventMonthGrid` in Task 6 (Steps 1 and 4b). No additional changes here.

- [ ] **Step 5: Add /history to nav-items.ts**

Edit `src/lib/nav-items.ts`:
```typescript
import { Inbox, Sun, History, Settings, Trash2 } from 'lucide-react';

export const navItems: NavItem[] = [
  { href: '/', label: '인박스', icon: Inbox },
  { href: '/today', label: '오늘', icon: Sun },
  { separator: true },
  { href: '/history', label: '히스토리', icon: History },
  { href: '/settings', label: '설정', icon: Settings },
  { separator: true },
  { href: '/tasks/trash', label: '휴지통', icon: Trash2 },
];
```

- [ ] **Step 6: Add page title to header**

Edit `src/components/layout/header.tsx`. Update `pageTitles` map:
```typescript
const pageTitles: Record<string, string> = {
  '/': '인박스',
  '/today': '오늘',
  '/history': '히스토리',            // NEW
  '/settings': '설정',
  '/tasks/new': '새 task',
  '/tasks/trash': '휴지통',
};
```

Remove `/weekly`, `/monthly` entries.

- [ ] **Step 7: Build + verify**

Run: `npm run build`
Manual: navigate to `/history`. Verify:
- Calendar on left with inline events + green completion count badges
- Right panel shows day detail (일정/완료/작업)
- Type in search → right panel shows results; calendar days highlight with ring
- Click a date → detail panel updates

- [ ] **Step 8: Commit**

```bash
git add src/app/history src/components/history src/components/dashboard/event-month-grid.tsx src/lib/nav-items.ts src/components/layout/header.tsx
git commit -m "feat: add History page with calendar + search (replaces weekly/monthly)"
```

---

## Phase 6: Cleanup

### Task 11: Route Redirects

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add redirects**

Edit `next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/weekly', destination: '/history', permanent: false },
      { source: '/monthly', destination: '/history', permanent: false },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify**

Run dev server. Navigate to `/weekly` → should redirect to `/history`. Same for `/monthly`.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: redirect deprecated /weekly and /monthly routes to /history"
```

---

### Task 12: Delete Removed Pages + Components

**Files:**
- Delete: `src/app/weekly/`, `src/app/monthly/`
- Delete: dashboard chart components listed in spec

- [ ] **Step 1: Delete weekly + monthly directories**

```bash
rm -rf "src/app/weekly"
rm -rf "src/app/monthly"
```

- [ ] **Step 2: Delete unused chart components**

```bash
rm src/components/dashboard/week-picker.tsx
rm src/components/dashboard/heatmap-calendar.tsx
rm src/components/dashboard/priority-pie-chart.tsx
rm src/components/dashboard/source-pie-chart.tsx
rm src/components/dashboard/duration-bar-chart.tsx
rm src/components/dashboard/trend-line-chart.tsx
rm src/components/dashboard/status-bar-chart.tsx
rm src/components/dashboard/timeline-chart.tsx
rm src/components/dashboard/summary-cards.tsx
```

- [ ] **Step 3: Remove dead types**

Edit `src/lib/types.ts`. Remove `WeeklyStats` and `MonthlyStats` interfaces.

- [ ] **Step 4: Build — fix any broken imports**

Run: `npm run build`

If build fails: check `src/components/loading/page-skeleton.tsx` — it may export `DashboardSkeleton` which imports components that no longer exist. Simplify `DashboardSkeleton` to a generic card skeleton (4 placeholder cards + 1 placeholder block) or remove if unused.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete weekly/monthly pages and unused chart components"
```

---

### Task 13: Terminology Sweep (일감 → task)

**Files:** All UI files (component `.tsx`, page `.tsx`)

- [ ] **Step 1: Audit with grep**

```bash
grep -rn "일감" src --include="*.tsx" --include="*.ts"
```

Note every occurrence in user-facing strings (JSX text, template literals, aria-labels, toast messages, placeholders).

- [ ] **Step 2: Replace systematically — file-by-file**

For each file below, replace every occurrence of "일감" with "task" in user-facing strings. Do NOT replace:
- TypeScript type names (like `Task`, `TaskProps`)
- File names or code identifiers
- Comments (optional)

**Known files to edit (grep your tree for the definitive list):**

1. `src/app/page.tsx` — inbox page (e.g., section titles like "처리 필요" stay; replace "일감" in empty states, toast messages, ConfirmDialog descriptions)
2. `src/app/tasks/[id]/page.tsx` — task detail page
3. `src/app/tasks/new/page.tsx` — quick new (if still exists)
4. `src/app/tasks/trash/page.tsx` — trash page
5. `src/app/settings/page.tsx` — settings intro copy (if mentions 일감)
6. `src/components/tasks/task-card.tsx`
7. `src/components/tasks/task-detail-panel.tsx`
8. `src/components/tasks/task-form.tsx`
9. `src/components/tasks/task-filters.tsx`
10. `src/components/tasks/quick-capture-modal.tsx`
11. `src/components/settings/slack-settings.tsx`
12. `src/components/layout/header.tsx` — modal titles, button labels
13. `src/components/ui/empty-state.tsx` callers (not the component itself)

**Canonical replacements:**

| Before | After |
|--------|-------|
| `새 일감` | `새 task` |
| `일감 목록` | `task 목록` |
| `일감 삭제` | `task 삭제` |
| `일감 상세` | `task 상세` |
| `일감 복구` | `task 복구` |
| `일감이 삭제되었습니다` | `task가 삭제되었습니다` |
| `일감이 등록되었습니다` | `task가 등록되었습니다` |
| `일감이 수정되었습니다` | `task가 수정되었습니다` |
| `일감이 복구되었습니다` | `task가 복구되었습니다` |
| `일감을 불러올 수 없습니다` | `task를 불러올 수 없습니다` |
| `이 일감을 ...` | `이 task를 ...` |
| `일감 제목` | `task 제목` |
| `일감 설명` | `task 설명` |
| `오늘 할 일감` | `오늘 할 task` |
| `오늘의 일감` | `오늘의 task` |
| `처리할 일감 N건` | `처리할 task N건` |
| `일감이 없습니다` | `task가 없습니다` |

**Quick sed hint (review before running):**
```bash
# Run from repo root. Prints files that would be modified:
grep -rl "일감" src --include="*.tsx" --include="*.ts"
# Then open each and apply the table above. Do NOT blanket sed-replace "일감" → "task"
# because Korean postposition ("을/를/이/가/의") follows the word and must be preserved.
```

- [ ] **Step 3: Verify**

```bash
grep -rn "일감" src --include="*.tsx" --include="*.ts"
```

Expected: only matches in comments (if any). No user-facing strings remain.

- [ ] **Step 4: Build**

Run: `npm run build`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename 일감 to task in all user-facing strings"
```

---

### Task 14: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: 0 errors, all routes generated including `/history`. `/weekly` and `/monthly` should NOT appear (redirects are runtime, not build-time artifacts).

- [ ] **Step 2: Manual flow check**

Start dev server. Verify each route:
- `/` — inbox with calendar subscriptions visible in sidebar
- `/today` — visual timeline, task list, no summary cards, no DateNavigator
- `/history` — calendar + day detail; search works; clicking a date updates right panel
- `/settings` — works as before
- `/weekly` → redirects to `/history`
- `/monthly` → redirects to `/history`
- Sidebar calendar checkboxes:
  - Unchecking a calendar hides its events from `/today` timeline AND `/history` calendar
  - Clicking color dot opens palette; selecting color updates all event displays immediately
- Terminology: no "일감" in user-facing strings

- [ ] **Step 3: Commit any final fixes**

If any issues found in Step 2, fix them and commit.

```bash
git add -A
git commit -m "fix: address issues from final verification"
```

---

## Summary

**15 tasks, organized in 6 phases:**

1. **Data model + APIs** (Tasks 1, 2, 2.5, 3) — Extend GCalEvent, add mock calendars, new endpoints, extend `/api/tasks` date filter.
2. **Calendar state** (Tasks 4-5) — localStorage hooks + sidebar panel.
3. **EventMonthGrid** (Task 6) — Per-calendar color, day click, count badge, search highlight ring, fluid width.
4. **Today page** (Tasks 7-8) — Visual timeline + task list refactor.
5. **History page** (Tasks 9-10) — Search lib + full page with detail panel.
6. **Cleanup** (Tasks 11-14) — Redirects, deletions, terminology, verify.

Each task has build + commit checkpoints. All code is provided inline so an agent with no codebase context can execute.

## Known Follow-ups (Not in This Plan)

These items from the spec are deferred to avoid scope creep. File issues after v2 ships:

1. **Error-handling UI polish** — spec describes retry buttons / fallback messages for each endpoint failure. The plan uses silent `catch {}` in fetch handlers; apiFetch handles basic toasts. A dedicated pass can add retry affordances on `/today` timeline and `/history` day panel.
2. **Mobile-specific History layout** — spec describes a compressed mobile layout (events as dots, badges only). The plan uses `lg:grid-cols-[minmax(0,1fr)_340px]` which stacks vertically below `lg`, but the calendar cells don't compress. Cells will overflow/scroll on narrow viewports until mobile-compression is added.
3. **`/api/stats/daily` | `weekly` | `monthly` deprecation** — these routes will be unused after this redesign. Deleting them is safe but low-priority cleanup. Leave for a follow-up PR.
4. **TodayTimeline overlapping events** — spec requires side-by-side rendering when events overlap. Plan's simple absolute-positioning will stack them. Address if real user hits it.
5. **`DashboardSkeleton`** becomes unused after the Today refactor (which inlines its own skeleton). Delete in a follow-up if no callers remain.
