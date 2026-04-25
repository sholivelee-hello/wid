# WID v2 Redesign — Task Inbox + Archive-First

**Date:** 2026-04-15
**Author:** Brainstorming session with user
**Status:** Draft — for implementation
**Revisions:** v1 (initial), v2 (addresses spec review issues 1-17)

## Context

The app is currently built around a time-axis hierarchy (오늘 / 주별 / 월별), all at the same navigation level. In brainstorming, the user confirmed:

- **Primary purpose:** manage overflowing tasks without missing any, and check today's schedule.
- **Weekly/monthly are archival**, not primary. Used occasionally to look back.
- When looking back, the user searches by **date AND keyword**, not statistics.
- The user's Google Calendar is a company account with **subscribed colleagues' calendars**. They want to toggle each calendar's visibility (show/hide events) from within WID — not manage subscriptions, just view visibility.

The current structure doesn't reflect these priorities: analytics dashboards compete with primary workflows, and the weekly/monthly split is redundant for archival lookup.

## Goals

1. Make the navigation hierarchy reflect actual usage: **primary daily tools** vs. **occasional archival lookup**.
2. Replace time-axis analytics (주별/월별) with a unified **date + search archival page** (히스토리).
3. Give the user always-visible control over which subscribed calendars appear in their views.
4. Remove aggregate statistics the user doesn't need. Keep per-task time visible.
5. Rename "일감" to "task" throughout the product.

## Non-Goals

- Real Google OAuth integration (mock data for demo; OAuth is future work).
- Adding/removing Google Calendar subscriptions from within WID (user manages in Google Calendar directly).
- New analytics or reporting features beyond archival lookup.
- Fuzzy / 초성 matching in search (v1 uses substring match only).

---

## Design

### 1. Navigation Restructure

**Sidebar (desktop, always visible):**

```
┌─────────────────────────────┐
│  WID                        │
├─────────────────────────────┤
│  📥 인박스           [N]    │  ← primary (task processing, route: `/`)
│  ☀️ 오늘                    │  ← primary (today overview, route: `/today`)
├─────────────────────────────┤
│  📅 히스토리                │  ← archival (calendar + search, route: `/history`)
│  ⚙️ 설정                    │  ← route: `/settings`
├─────────────────────────────┤
│  🗓️ 내 캘린더               │  ← subscription checkboxes (always visible)
│   ☑ ● 내 캘린더             │
│   ☑ ● 김민지 (디자인)        │
│   ☑ ● 박서준 (백엔드)        │
│   ☐ ● 정하윤 (PM)            │
│   ☑ ● 최유진 (프론트)        │
├─────────────────────────────┤
│  [◂ 접기]                   │
└─────────────────────────────┘
```

**Route decisions:**
- **Inbox stays at `/`** (the root route). No change.
- **Today stays at `/today`** (existing route).
- **`/history` is a new route.**
- **`/weekly` and `/monthly` are removed.** Add Next.js redirects (in `next.config.ts`): `/weekly` → `/history`, `/monthly` → `/history`. This preserves any user bookmarks.
- `/tasks/trash` and `/tasks/new` still exist but are not in the primary nav (reached via task list actions and header button respectively).

**Mobile:** Same structure replicated in the existing Sheet mobile menu.

### 2. Today Page (`/today`)

**Purpose:** At-a-glance view of today's schedule + actionable tasks. **No date navigation** — the page always shows today's data. Browsing past/future days goes through 히스토리.

**DateNavigator is removed from this page.** The component file itself stays (may be reused elsewhere).

**Layout (vertical stack):**

```
☀️ 오늘, 12월 20일 (금)
오늘 일정 3건 · 처리할 task 5건

🗓️ 오늘의 일정              ← Visual timeline (Google Calendar day view style)
(timeline block)

📋 오늘 할 task               ← filtered list
[task cards]

✅ 오늘 완료 (3)  [펼치기]    ← collapsed by default
```

**Header line:**

- "오늘 일정 N건" — count of today's visible GCal events (after subscription filtering).
- "처리할 task N건" — count of tasks matching the "오늘 할 task" filter (§2.2).
- Replaces all prior summary cards.

#### 2.1 Visual timeline

- Fixed y-axis range: **7am to 10pm (15 hours)**. If any event falls outside this range, auto-expand by adding hour rows as needed.
- Each event rendered as a time-blocked rectangle:
  - Top position = event start time on the hour axis.
  - Height = `(endTime − startTime) × HOUR_PIXELS`, where `HOUR_PIXELS = 48px` (one-hour row).
  - Minimum height = 24px (short events still readable).
- Each block displays: time range, title, calendar owner name.
- Block left-border color (4px) = the calendar's user-assigned color (§4).
- Block background: `bg-{color}/10` tint for fill.
- All-day events render as a separate strip at the top of the timeline.
- Overlapping events: render side-by-side within the same hour band (split column width).
- Empty state: "오늘 예정된 일정이 없습니다".

**`endTime` requirement — resolved from v1 Open Question:**

Add `endTime?: string` (`HH:MM`) to the `GCalEvent` interface. When missing, default duration = 30 minutes. Update mock data to include realistic `endTime` values for all 11 existing events.

#### 2.2 오늘 할 task (filter logic)

A task is included if ALL of these are true:
- `is_deleted === false`
- `status NOT IN ['완료', '위임', '취소']`

AND at least ONE of these is true:
- `status === '진행중'`
- `deadline` ≤ today (i.e., due today or overdue) AND `status !== '완료'`
- `started_at` is today

This filtering is **performed client-side**. The Today page fetches the full active task list via the existing `/api/tasks?deleted=false` endpoint and filters in React. No API change needed.

**Why client-side:** The filter combines fields in ways the current `/api/tasks` query params don't cover (deadline range + started_at range + status exclusion). Client-side filtering is acceptable for a personal tool with ~100s of tasks.

#### 2.3 오늘 완료 섹션

- Collapsible. Fetches all tasks where `status === '완료'` AND `completed_at` date is today.
- Uses the same `/api/tasks?deleted=false` response — filter client-side.
- Small count badge on the collapsed header.
- Default state: **collapsed**.

#### 2.4 Existing API: `/api/stats/daily`

**Fate:** This endpoint becomes unused by the Today page (which now uses `/api/tasks` + client filter). Keep the endpoint for now (other callers may exist), but it's not exercised by the v2 Today page. It can be removed in a cleanup pass if no callers remain after the redesign.

### 3. History Page (`/history`)

**Purpose:** Unified archival lookup by date and by keyword.

**Layout (two-column on desktop):**

```
┌────────────────────────────────────────────────────────────┐
│ 📅 히스토리                                                │
│ 🔍 [task 제목/설명/요청자/위임대상 검색...]                │
├────────────────────────────────┬───────────────────────────┤
│ [◂] 2025년 12월 [▸]            │ 📌 12월 20일 (금)          │
│                                │                           │
│ 월 화 수 목 금 토 일            │ 🗓️ 일정 (3)                │
│ (month grid with inline        │ (event list)              │
│  events + completed-count      │                           │
│  badge per day)                │ ✅ 완료한 task (2)         │
│                                │ (task cards, mini)        │
│                                │                           │
│                                │ ⏱️ 작업한 task (3)         │
│                                │ (task + duration)         │
└────────────────────────────────┴───────────────────────────┘
```

**Mobile layout (< lg breakpoint):** Single column, stacked top-to-bottom. The month grid comes first (compressed: events reduced to a small colored dot and task-count badge), and the day detail panel appears below when a date is selected. Both sections scroll together.

#### 3.1 Calendar (left)

- Reuses `EventMonthGrid` with modifications (§3.5). No separate `history-calendar.tsx` component. This replaces the v1 spec's ambiguous "extends/adapts" language.
- Month navigation (prev/next) at the top of the calendar.
- Each cell shows:
  - Date number (today highlight: primary-colored circle).
  - Inline event titles (max 3, "+N" overflow) — event colors use per-calendar color from `CalendarViewState` (§4).
  - Completed-task-count badge ("● 2") in muted emerald when > 0.
- Individual day cells are clickable → selects that specific day for the detail panel.
- Whole week rows are clickable → selects Monday of that week.
- Implementation: day cells are nested `<button>` elements inside the week `<button>`. Day clicks use `e.stopPropagation()` to prevent the week click from firing.

#### 3.2 Day detail panel (right)

Three sections for the currently selected date:

1. **🗓️ 일정** — Google Calendar events that day, time-sorted. Filtered by the sidebar calendar visibility toggles (§4). Each event shows its calendar owner name and uses the calendar's assigned color.

2. **✅ 완료한 task** — tasks where `completed_at` falls on that day. Rendered as mini `TaskCard`s (no inline actions to keep the panel compact; click opens the full `TaskDetailPanel`).

3. **⏱️ 작업한 task** — tasks that have `time_log` entries on that day. Shows **duration spent on that specific day** next to the task title (not aggregate lifetime time).

#### 3.3 Search mode

When the search input has content:

- The right panel switches from "day detail" to "search results."
- Results rendered as task cards, **grouped by date** (using `completed_at` if present, else `created_at`). Most recent group first.
- Within each date group, results sorted by **relevance score** (§3.4).
- The left calendar **highlights dates with matching results** using a thin primary-colored ring around the day cell (`ring-1 ring-primary`).
- Clicking a date in the calendar while search is active: clears the search and switches back to day-detail mode for that date.
- Clicking a result card: opens the standard `TaskDetailPanel` (same flow as elsewhere).
- Clearing the search: returns to day-detail mode for the most recently selected date (or today if none).

**Search scope:** `task.title` + `task.description` + `task.requester` + `task.delegate_to`.

**Search debounce:** 300ms.

#### 3.4 Relevance scoring

Implemented in `src/lib/search.ts` as `scoreTask(task, query): number`. The query is lowercased and trimmed once.

```
score = 0
if title contains query: score += 100
if description contains query: score += 50
if requester contains query: score += 30
if delegate_to contains query: score += 30
score += recency_bonus  // min(10, days_in_past_capped)
```

Recency tiebreaker: `recency_bonus = max(0, 10 − daysSinceCompletion)` where `daysSinceCompletion` is the number of days between `completed_at` (or `created_at` if null) and today, capped at 10.

Results with score ≤ 0 are excluded. No fuzzy / 초성 matching in v1.

#### 3.5 Data fetching strategy

The History page makes these API calls:

| Purpose | Endpoint | Query | Response shape |
|---|---|---|---|
| All tasks for the visible month (for search AND for day-detail sections AND for completed-task-count badges) | `GET /api/tasks?from=<month-start>&to=<month-end>&deleted=false` | Include all statuses (so 완료 and 진행중 and 대기 are all available) | `Task[]` |
| All GCal events for the visible month | `GET /api/gcal/events?from=<month-start>&to=<month-end>` | — | `GCalEvent[]` |
| All time_logs for the visible month | `GET /api/time-logs?from=<month-start>&to=<month-end>` | NEW endpoint (see §3.6) | `TimeLog[]` (with `task_id`) |

**All aggregation (completed-task count per day, worked-on-task duration per day) is computed client-side** from the three fetched lists. This means:
- No new per-day summary endpoint needed.
- When the user navigates to a different month, three fetches fire in parallel.
- When the sidebar subscription state changes, no refetch — just re-render with filter.

**Modified `/api/tasks` endpoint:** The `GET /api/tasks` route currently accepts `status`, `priority`, `source`, `from`, `to`, `deleted`. The spec requires no change — `from` and `to` already filter by `created_at`. We extend the usage pattern to also pull tasks whose `completed_at` OR `created_at` falls in the range (matches existing behavior). Verify during implementation that this matches the `/api/stats/monthly` pattern.

#### 3.6 New endpoint: `GET /api/time-logs`

**Path:** `src/app/api/time-logs/route.ts` (new).

**Query parameters:**
- `from` (required, `YYYY-MM-DD`) — range start (inclusive).
- `to` (required, `YYYY-MM-DD`) — range end (inclusive).

**Response:** `TimeLog[]` — all time_log records whose `started_at` date falls within the range.

**Implementation:** Supabase query `select * from time_logs where started_at >= :from and started_at <= :to_end_of_day`. Include mock-mode fallback following the same pattern as existing mock routes.

#### 3.7 Removed from `/weekly` and `/monthly`

All charts on those pages are deleted with the pages themselves:
- Pie charts (priority, source, status distribution).
- Bar charts (status, duration).
- Trend line chart.
- Heatmap calendar.
- Summary cards (완료/위임/취소/평균 처리시간).

### 4. Calendar Subscriptions

#### 4.1 Data model

```typescript
// Event gains calendarId
interface GCalEvent {
  id: string;
  calendarId: string;        // NEW
  title: string;
  date: string;              // YYYY-MM-DD
  time?: string;             // HH:MM (start)
  endTime?: string;          // NEW — HH:MM (end); default duration 30min when missing
  location?: string;
}

// Master list of subscribed calendars (read-only; comes from Google Calendar in real mode)
interface CalendarSubscription {
  id: string;                // e.g., 'me', 'kim_minji'
  name: string;              // "김민지"
  role?: string;             // "디자인", optional
  defaultColor: string;      // shipped default hex
}

// User's local view preferences per calendar
// Stored at: localStorage['wid-calendar-view-state']
type CalendarViewState = {
  [calendarId: string]: {
    visible: boolean;        // show events in UI?
    color: string;           // user-picked color (overrides defaultColor)
  };
};
```

#### 4.2 Mock data (demo mode)

Five subscribed calendars:

| id | name | role | default color |
|----|------|------|---------------|
| `me` | 내 캘린더 | — | `#6366F1` (indigo) |
| `kim_minji` | 김민지 | 디자인 | `#14B8A6` (teal) |
| `park_sejun` | 박서준 | 백엔드 | `#F59E0B` (amber) |
| `jeong_hayoon` | 정하윤 | PM | `#8B5CF6` (violet) |
| `choi_yujin` | 최유진 | 프론트 | `#10B981` (emerald) |

Existing 11 mock events redistributed across these 5 calendars (distribution TBD during implementation, any reasonable split works).

#### 4.3 Sidebar UI

- Section titled "내 캘린더" at the bottom of the sidebar (below `설정`).
- No "add calendar" button — the subscribed list is read-only.
- Each calendar row:
  - Checkbox (visibility toggle).
  - Colored dot (16px, clickable → opens color picker popover).
  - Name + role.
  - Whole row is hoverable; clicking anywhere outside the color dot or checkbox toggles visibility.
- Sidebar collapsed mode: the section is hidden (only icon nav shown).
- Max visible count: scroll after `max-h-[240px]` (useful only if a real GCal account has many subscriptions).

#### 4.4 Color picker

- Popover opens on color dot click.
- 8-color preset palette: indigo `#6366F1`, teal `#14B8A6`, amber `#F59E0B`, violet `#8B5CF6`, emerald `#10B981`, rose `#F43F5E`, cyan `#06B6D4`, slate `#64748B`.
- Selecting a color updates `CalendarViewState[id].color` in localStorage, fires a `calendar-view-state-changed` CustomEvent; all consumers re-render.

#### 4.5 Hook API (`src/lib/calendar-view-state.ts`)

Follow the same pattern as the existing `src/lib/hidden-statuses.ts`.

```typescript
// Read the full state map (merged with defaults from the subscriptions list).
function useCalendarViewState(subscriptions: CalendarSubscription[]): CalendarViewState;

// Convenience: visibility check for a single calendar.
function useCalendarVisible(calendarId: string): boolean;

// Convenience: current color for a single calendar (falls back to defaultColor).
function useCalendarColor(calendarId: string, subscriptions: CalendarSubscription[]): string;

// Mutators — dispatch 'calendar-view-state-changed' after writing.
function setCalendarVisible(calendarId: string, visible: boolean): void;
function setCalendarColor(calendarId: string, color: string): void;
```

The hooks use a `useState` + `useEffect` listener pattern (not `useSyncExternalStore`, to stay consistent with the existing hidden-statuses pattern).

#### 4.6 Visibility effects

A calendar's events are hidden from:
- Today page timeline (§2.1).
- History calendar cells' inline events (§3.1).
- History day detail's 일정 section (§3.2).

The `/api/gcal/events` endpoint continues to return all events; filtering is applied client-side. This keeps the server stateless.

### 5. Terminology Change: "일감" → "task"

All user-facing Korean text currently using "일감" (or variants like "일감 목록", "새 일감", "일감 삭제") is updated to use "task".

Examples:
- "새 일감" → "새 task"
- "일감 목록" → "task 목록"
- "오늘 할 일감" → "오늘 할 task"
- "처리할 일감 N건" → "처리할 task N건"
- Page titles, button labels, toast messages, modal titles, empty states, aria-labels.

Code identifiers (variable names, TypeScript types like `Task`) remain as-is — they already use the English word. Testing: grep for `일감` across `src/**/*.{ts,tsx}` and confirm zero matches in user-facing strings.

### 6. Removed Features

Explicitly removed in this version:

- `/weekly` page and all its components (route now redirects).
- `/monthly` page and all its components (route now redirects).
- All aggregate time displays ("총 소요시간", "평균 처리시간", "일평균 소요시간"). Per-task time remains.
- Pie charts (priority, source).
- Bar charts (duration, status distribution).
- Line charts (weekly completion trend).
- Heatmap calendar.
- Summary cards on Today showing aggregate counts.

---

## Components & Files Impact

### New

- `src/app/history/page.tsx` — History page.
- `src/components/history/day-detail-panel.tsx` — Right-side detail for selected day.
- `src/components/history/search-results.tsx` — Search result list (grouped by date).
- `src/components/today/today-timeline.tsx` — Visual timeline for Today page.
- `src/components/layout/calendar-subscriptions.tsx` — Sidebar checkbox list + color picker.
- `src/lib/calendar-view-state.ts` — localStorage-backed hooks (§4.5) following the `hidden-statuses.ts` pattern.
- `src/lib/mock-calendars.ts` — Mock subscription list (5 calendars, §4.2).
- `src/app/api/gcal/calendars/route.ts` — Returns `CalendarSubscription[]` (currently mock).
- `src/app/api/time-logs/route.ts` — Returns `TimeLog[]` for a date range (§3.6).
- `src/lib/search.ts` — Client-side relevance-based search function (§3.4).

### Modified

- `src/lib/nav-items.ts` — Remove `/weekly`, `/monthly`; add `/history`.
- `src/components/layout/sidebar.tsx` — Render `CalendarSubscriptions` panel after the primary nav.
- `src/components/layout/header.tsx` — Page titles for `/history`; remove weekly/monthly titles; keep 새 task button logic.
- `src/app/today/page.tsx` — Replace current content with new layout (timeline + task list + completed collapsible). Remove summary cards and `DateNavigator`. Switch to `/api/tasks?deleted=false` + client-side filter.
- `src/components/dashboard/event-month-grid.tsx` — 
  - Event pills use per-calendar color from `CalendarViewState` (not hardcoded primary).
  - Add `onDaySelect?: (date: Date) => void` prop to support individual day clicks.
  - Add `completedCountByDate?: Map<string, number>` prop to render per-cell badges.
  - When `onDaySelect` is provided, each day cell is a nested `<button>` using `e.stopPropagation()` to avoid firing the week-row click.
- `src/lib/mock-gcal.ts` — Add `calendarId` to every event; add `endTime` with realistic values; redistribute events across 5 calendars.
- `src/app/api/gcal/events/route.ts` — Return events with `calendarId` and `endTime`.
- `src/lib/types.ts` — Remove `WeeklyStats` and `MonthlyStats` types (dead code after weekly/monthly pages are deleted). Keep `DailyStats` for now if other callers remain.
- `next.config.ts` — Add redirects: `/weekly` → `/history`, `/monthly` → `/history`.
- All files using "일감" strings — replace with "task" (see §5).

### Deleted

- `src/app/weekly/` (entire directory).
- `src/app/monthly/` (entire directory).
- `src/components/dashboard/week-picker.tsx` — unused after `/weekly` is deleted.
- `src/components/dashboard/heatmap-calendar.tsx`.
- `src/components/dashboard/priority-pie-chart.tsx`.
- `src/components/dashboard/source-pie-chart.tsx`.
- `src/components/dashboard/duration-bar-chart.tsx`.
- `src/components/dashboard/trend-line-chart.tsx`.
- `src/components/dashboard/status-bar-chart.tsx`.
- `src/components/dashboard/timeline-chart.tsx` (the hourly-work bar chart; replaced by the new `today-timeline.tsx`).
- `src/components/dashboard/summary-cards.tsx` — no longer used after Today removes summary cards.

### Kept (but may need small tweaks)

- `src/components/dashboard/chart-tooltip.tsx` — may be reused later.
- `src/components/dashboard/chart-empty.tsx` — may be reused later.
- `src/components/dashboard/date-navigator.tsx` — no longer used on Today; the `DateNavigator` component itself stays in case it's needed elsewhere (e.g., a future per-day drill-down). If after redesign nothing uses it, delete as part of cleanup.
- `src/components/loading/page-skeleton.tsx` — `DashboardSkeleton` stays but should be simplified/renamed if its shape no longer matches any page. `TaskListSkeleton` still used by Inbox.

---

## Error Handling

- If `/api/gcal/calendars` fails: fall back to the default 5 mock calendars for demo; in real mode, show an error state in the sidebar section ("캘린더를 불러올 수 없습니다 [다시 시도]").
- If `/api/gcal/events` fails: timeline/history show "일정을 불러올 수 없습니다" with retry.
- If `/api/time-logs` fails: History day detail's "작업한 task" section shows "작업 기록을 불러올 수 없습니다" with retry; other sections still render.
- Search with no results: "'{검색어}'에 대한 결과가 없습니다".
- History day with no content: "이 날짜에 활동이 없습니다".
- localStorage unavailable (private mode, etc.): fall back to in-memory state for the session; log a warning; visibility changes don't persist across reloads.

---

## Testing Approach

Prioritize these tests:

- **Navigation redirects:** `/weekly` and `/monthly` routes redirect to `/history` (not 404).
- **Calendar visibility toggle:** Events filter correctly in both Today timeline and History calendar immediately on toggle.
- **Color change propagation:** Changing a calendar's color updates all event pills across all visible pages within one render tick.
- **History search relevance:** Title match ranks above description match; metadata matches appear lowest. Verified via test cases with known inputs/outputs.
- **History date selection:** Selecting a specific day shows correct "완료한 task" and "작업한 task" sections.
- **Today timeline:** Events render with correct height (proportional to duration), correct position (aligned to start time), and overlapping events render side-by-side.
- **Today task filter:** A task with `status='진행중'` AND `deadline` in the future still appears. A task with `status='완료'` never appears. An overdue task with `status='대기'` appears.
- **Today "오늘 완료" section:** Counts and lists only tasks with `completed_at` today.
- **Terminology sweep:** `grep -R "일감" src/**/*.{ts,tsx}` returns zero matches in user-facing strings (JSX text nodes, toast messages, aria-labels).
- **Mobile History layout:** At < lg breakpoint, calendar and day detail stack vertically; no horizontal scroll.

---

## Implementation Order

Suggested sequence (each step unblocks the next):

1. **Data model updates:** `GCalEvent.calendarId`, `GCalEvent.endTime`, `mock-calendars.ts`, updated `mock-gcal.ts`.
2. **`/api/time-logs` endpoint + `/api/gcal/calendars` endpoint** (new).
3. **`calendar-view-state.ts` hooks + localStorage persistence.**
4. **Sidebar calendar subscriptions panel** (`calendar-subscriptions.tsx`) + sidebar integration.
5. **`EventMonthGrid` modifications** (per-calendar color, day-select prop, completed-count badge prop).
6. **Today page refactor:** new timeline component, new layout, removal of summary cards + DateNavigator.
7. **History page + search:** new route, `day-detail-panel.tsx`, `search-results.tsx`, `search.ts`.
8. **Terminology sweep:** replace "일감" with "task" everywhere.
9. **Route redirects** (`next.config.ts`).
10. **Deletions:** remove weekly/monthly pages, unused chart components.
11. **Nav + header updates.**
12. **Final build + test passes.**

The calendar subscription system (steps 3-4) is a cross-cutting concern and must be in place before the Today timeline and History calendar can use it. Steps 1-2 are data-layer prerequisites.

---

## Open Questions / Future Work

Remaining open items (not blocking v2 implementation):

1. **Real Google OAuth integration** — future work, not in this spec.
2. **Search result pagination** — if results exceed ~50 items on History, virtualize or paginate. For demo, full list is fine.
3. **Today timeline vertical density** — `HOUR_PIXELS = 48px` is a starting value; may need tuning based on real-device testing.
4. **Removed chart components** — `chart-tooltip.tsx` and `chart-empty.tsx` are retained in case future features reuse them. If no callers remain after a few iterations, delete as cleanup.
5. **DailyStats type** — retained for now; delete if `/api/stats/daily` has no callers after implementation.

---

## Success Criteria

- Navigation clearly distinguishes daily-use items (Inbox, Today) from occasional-use archive (History).
- A user can find a past task in under 10 seconds using either date navigation or keyword search.
- Toggling a subscribed calendar's visibility updates all views immediately with no navigation.
- No aggregate time statistics anywhere; per-task time remains prominent.
- All user-facing Korean text uses "task" instead of "일감".
- Build passes (`npm run build`) with no TypeScript errors.
- `/weekly` and `/monthly` bookmarks redirect to `/history` (no broken links).
