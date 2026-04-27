'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, addWeeks, addMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EventMonthGrid } from '@/components/dashboard/event-month-grid';
import { DayDetailPanel } from '@/components/history/day-detail-panel';
import { WeekDetailPanel } from '@/components/history/week-detail-panel';
import { SearchResults } from '@/components/history/search-results';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { apiFetch } from '@/lib/api';
import { searchTasks } from '@/lib/search';
import { useCalendarViewState } from '@/lib/calendar-view-state';
import type { Task, Issue } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { getGCalConfig, setGCalConfig, getActiveCalendarIds, GCAL_EMBED_EVENT } from '@/lib/gcal-embed';
import { isTokenExpired } from '@/lib/gcal-oauth';
import { fetchEventsForRange } from '@/lib/gcal-events';
import { Search, X } from 'lucide-react';

type ViewMode = 'day' | 'week';

export default function HistoryPage() {
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [globalTasks, setGlobalTasks] = useState<Task[]>([]);
  const [globalTasksLoaded, setGlobalTasksLoaded] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  // Track previous debounced search to detect first-typed transition for monthCursor auto-jump
  const prevDebouncedRef = useRef('');
  // Latest globalTasks via ref so the debounce callback can read without re-creating itself
  const globalTasksRef = useRef<Task[]>([]);
  useEffect(() => { globalTasksRef.current = globalTasks; }, [globalTasks]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const wasEmpty = prevDebouncedRef.current === '';
      prevDebouncedRef.current = v;
      setDebouncedSearch(v);
      // First-typed transition: jump monthCursor to most recent match if globalTasks already loaded.
      // If globalTasks isn't ready yet, the dedicated effect below will refetch and the user can scroll;
      // intentionally not chained to avoid an effect-setState cascade.
      if (v && wasEmpty) {
        const matches = searchTasks(globalTasksRef.current, v);
        if (matches.length > 0) {
          const refStr = matches[0].completed_at ?? matches[0].created_at;
          if (refStr) {
            const newestDate = parseISO(refStr.slice(0, 10));
            setMonthCursor(prev =>
              isSameDay(startOfMonth(prev), startOfMonth(newestDate)) ? prev : newestDate
            );
          }
        }
      }
      if (!v) prevDebouncedRef.current = '';
    }, 300);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const fetchAll = useCallback(async () => {
    const from = format(startOfMonth(monthCursor), 'yyyy-MM-dd');
    const to = format(endOfMonth(monthCursor), 'yyyy-MM-dd');
    try {
      const config = getGCalConfig();
      const activeIds = getActiveCalendarIds(config);
      const oauthValid = config.oauth !== null && !isTokenExpired(config.oauth);

      let eventsPromise: Promise<GCalEvent[]>;
      if (oauthValid && activeIds.length > 0) {
        eventsPromise = fetchEventsForRange(config.oauth!.accessToken, activeIds, from, to).catch(
          (err: unknown) => {
            if (err instanceof Error && err.message === 'unauthorized') {
              // Token expired between client check and fetch — clear and fall back
              setGCalConfig({ ...config, oauth: null });
            }
            // Fall back to mock for this load
            return apiFetch<GCalEvent[]>(`/api/gcal/events?from=${from}&to=${to}`, { suppressToast: true });
          },
        );
      } else {
        eventsPromise = apiFetch<GCalEvent[]>(`/api/gcal/events?from=${from}&to=${to}`, { suppressToast: true });
      }

      const [t, e, s, i] = await Promise.all([
        apiFetch<Task[]>(`/api/tasks?deleted=false&from=${from}&to=${to}&dateField=either`, { suppressToast: true }),
        eventsPromise,
        apiFetch<CalendarSubscription[]>('/api/gcal/calendars', { suppressToast: true }),
        apiFetch<Issue[]>('/api/issues', { suppressToast: true }).catch(() => [] as Issue[]),
      ]);
      setTasks(t); setEvents(e); setSubs(s); setIssues(i);
    } catch {}
  }, [monthCursor]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch when the user toggles a calendar in settings
  useEffect(() => {
    const handler = () => { void fetchAll(); };
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, [fetchAll]);

  // Global task fetch for search — fires only when a search query is active.
  // Decoupled from monthCursor so matches across all months are surfaced.
  // `globalTasksLoaded` gates the SearchResults render so the empty-state flicker
  // (one frame between debouncedSearch set and globalTasks arrival) is suppressed.
  useEffect(() => {
    if (!debouncedSearch) return;
    let cancelled = false;
    apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true })
      .then(t => { if (!cancelled) { setGlobalTasks(t); setGlobalTasksLoaded(true); } })
      .catch(() => { if (!cancelled) setGlobalTasksLoaded(true); });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  // Calendar visibility — apply once at this layer so subtitle counts and panel
  // counts agree (panels still call useCalendarViewState internally; identical input → identical filter).
  const calendarViewState = useCalendarViewState(subs);
  const visibleEvents = useMemo(
    () => events.filter(e => calendarViewState[e.calendarId]?.visible !== false),
    [events, calendarViewState]
  );

  const completedCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== '완료' || !t.completed_at) continue;
      const d = t.completed_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  // Search runs against globalTasks when active so other-month matches surface.
  const searchPool = debouncedSearch ? globalTasks : tasks;
  const searchMatchTasks = useMemo(() => {
    if (!debouncedSearch) return [] as Task[];
    return searchTasks(searchPool, debouncedSearch);
  }, [searchPool, debouncedSearch]);

  const searchMatchDates = useMemo(() => {
    if (!debouncedSearch) return new Set<string>();
    return new Set(searchMatchTasks.map(t => (t.completed_at ?? t.created_at).slice(0, 10)));
  }, [searchMatchTasks, debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    prevDebouncedRef.current = '';
  }, []);

  const handleDayDrillDown = useCallback((dateStr: string) => {
    const d = parseISO(dateStr);
    setSelectedDate(d);
    setViewMode('day');
  }, []);

  // Counts use visibleEvents so subtitle matches the panel's own filter result.
  const dayCounts = useMemo(() => {
    if (!selectedDate) return { events: 0, completed: 0 };
    const ds = format(selectedDate, 'yyyy-MM-dd');
    const eventsCount = visibleEvents.filter(e => e.date === ds).length;
    const completedCount = tasks.filter(t => t.status === '완료' && t.completed_at?.startsWith(ds)).length;
    return { events: eventsCount, completed: completedCount };
  }, [selectedDate, visibleEvents, tasks]);

  const weekCounts = useMemo(() => {
    if (!selectedWeekStart) return { events: 0, completed: 0 };
    const from = format(selectedWeekStart, 'yyyy-MM-dd');
    const to = format(endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const eventsCount = visibleEvents.filter(e => e.date >= from && e.date <= to).length;
    const completedCount = tasks.filter(t => {
      const d = t.completed_at?.slice(0, 10);
      return t.status === '완료' && d && d >= from && d <= to;
    }).length;
    return { events: eventsCount, completed: completedCount };
  }, [selectedWeekStart, visibleEvents, tasks]);

  const subtitle = useMemo(() => {
    const baseParts: string[] = [];
    if (viewMode === 'week' && selectedWeekStart) {
      const wEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
      baseParts.push(`${format(selectedWeekStart, 'M월 d일', { locale: ko })} ~ ${format(wEnd, 'M월 d일', { locale: ko })} · 일정 ${weekCounts.events}건 · 완료 ${weekCounts.completed}건`);
    } else if (viewMode === 'day' && selectedDate) {
      baseParts.push(`${format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })} · 일정 ${dayCounts.events}건 · 완료 ${dayCounts.completed}건`);
    }
    if (debouncedSearch) {
      baseParts.push(`검색 매치 ${searchMatchTasks.length}건 · ${searchMatchDates.size}개 날짜`);
    }
    return baseParts.length > 0 ? baseParts.join(' · ') : null;
  }, [debouncedSearch, searchMatchTasks.length, searchMatchDates.size, viewMode, selectedWeekStart, selectedDate, dayCounts, weekCounts]);

  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setSelectedWeekStart(prev => {
      const base = prev ?? startOfWeek(new Date(), { weekStartsOn: 1 });
      return addWeeks(base, direction === 'prev' ? -1 : 1);
    });
  }, []);

  type QuickRange = 'this-week' | 'last-week' | 'last-month';
  const applyDateRange = useCallback((range: QuickRange) => {
    // Preserve active search — quick chips only change date range, mirroring drill-down behavior.
    const now = new Date();
    if (range === 'this-week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      setMonthCursor(ws);
      setSelectedWeekStart(ws);
      setViewMode('week');
    } else if (range === 'last-week') {
      const ws = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -1);
      setMonthCursor(ws);
      setSelectedWeekStart(ws);
      setViewMode('week');
    } else if (range === 'last-month') {
      const prev = addMonths(now, -1);
      const ws = startOfWeek(startOfMonth(prev), { weekStartsOn: 1 });
      setMonthCursor(prev);
      setSelectedWeekStart(ws);
      setViewMode('week');
    }
  }, []);

  const activeQuickRange = useMemo<QuickRange | null>(() => {
    if (viewMode !== 'week' || !selectedWeekStart) return null;
    const now = new Date();
    const thisWs = startOfWeek(now, { weekStartsOn: 1 });
    const lastWs = addWeeks(thisWs, -1);
    const lastMonthWs = startOfWeek(startOfMonth(addMonths(now, -1)), { weekStartsOn: 1 });
    if (isSameDay(selectedWeekStart, thisWs)) return 'this-week';
    if (isSameDay(selectedWeekStart, lastWs)) return 'last-week';
    if (isSameDay(selectedWeekStart, lastMonthWs)) return 'last-month';
    return null;
  }, [viewMode, selectedWeekStart]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const gridSelectedDate = viewMode === 'week' && selectedWeekStart
    ? selectedWeekStart
    : (selectedDate ?? new Date());

  // Sync selectedWeekStart / selectedDate when monthCursor changes so grid + panel stay aligned.
  const handleMonthChange = useCallback((d: Date) => {
    setMonthCursor(d);
    if (viewMode === 'week') {
      setSelectedWeekStart(prev => {
        // Preserve the week's weekday offset from the previous selection if any; otherwise start of month.
        const base = prev ?? startOfMonth(d);
        const offsetDays = Math.round((base.getTime() - startOfMonth(base).getTime()) / 86400000);
        const target = new Date(d);
        target.setDate(Math.min(offsetDays + 1, endOfMonth(d).getDate()));
        return startOfWeek(target, { weekStartsOn: 1 });
      });
    } else if (viewMode === 'day') {
      setSelectedDate(prev => {
        const base = prev ?? startOfMonth(d);
        const offsetDays = Math.round((base.getTime() - startOfMonth(base).getTime()) / 86400000);
        const target = new Date(d);
        target.setDate(Math.min(offsetDays + 1, endOfMonth(d).getDate()));
        return target;
      });
    }
  }, [viewMode]);

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Compact header: title + mode toggle + search + quick chips on a single row at md+ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            히스토리
          </h1>
        </div>

        <div className="inline-flex h-9 items-center rounded-md border bg-muted/30 p-0.5 shrink-0" role="group" aria-label="보기 모드">
          <Button
            type="button"
            variant={viewMode === 'day' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            aria-pressed={viewMode === 'day'}
            onClick={() => {
              setViewMode('day');
              if (!selectedDate) setSelectedDate(new Date());
            }}
          >
            일별
          </Button>
          <Button
            type="button"
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            aria-pressed={viewMode === 'week'}
            onClick={() => {
              setViewMode('week');
              if (!selectedWeekStart) {
                setSelectedWeekStart(startOfWeek(selectedDate ?? new Date(), { weekStartsOn: 1 }));
              }
            }}
          >
            주별
          </Button>
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.preventDefault();
                clearSearch();
              }
            }}
            placeholder="task 제목/설명/요청자/위임대상 검색..."
            aria-label="task 검색"
            className="pl-9 pr-9 h-9"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="검색 지우기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0">
          {([
            { id: 'this-week' as const, label: '이번 주' },
            { id: 'last-week' as const, label: '지난 주' },
            { id: 'last-month' as const, label: '지난 달' },
          ]).map(chip => {
            const isActive = activeQuickRange === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyDateRange(chip.id)}
                aria-pressed={isActive}
                className={
                  'px-2 py-0.5 rounded-full text-[11px] transition-colors ' +
                  (isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground')
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {subtitle && (
        <p className="text-sm text-muted-foreground -mt-2">{subtitle}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="space-y-4">
          <EventMonthGrid
            selectedDate={gridSelectedDate}
            today={todayStr}
            monthCursor={monthCursor}
            onMonthChange={handleMonthChange}
            onWeekSelect={(d) => {
              setSelectedWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
              setViewMode('week');
            }}
            onDaySelect={(d) => {
              setSelectedDate(d);
              setViewMode('day');
            }}
            events={events}
            completedCountByDate={completedCountByDate}
            searchHighlightDates={searchMatchDates}
          />

          {debouncedSearch && (
            <section
              className="border rounded-lg p-4 bg-card"
              aria-label="검색 결과"
            >
              <header className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  검색 결과 <span className="text-muted-foreground font-normal">{searchMatchTasks.length}건</span>
                </h3>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> 검색 지우기
                </button>
              </header>
              {!globalTasksLoaded ? (
                <p className="text-sm text-muted-foreground">검색 중...</p>
              ) : (
                <SearchResults
                  tasks={searchPool}
                  issues={issues}
                  query={debouncedSearch}
                  onTaskClick={setSelectedTaskId}
                  onClearSearch={clearSearch}
                  onDayClick={handleDayDrillDown}
                />
              )}
            </section>
          )}
        </div>

        <div className="border rounded-lg p-4 bg-card min-h-[400px] lg:sticky lg:top-[7rem] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {viewMode === 'week' ? (
            <WeekDetailPanel
              weekStart={selectedWeekStart}
              tasks={tasks}
              events={events}
              subscriptions={subs}
              onTaskClick={setSelectedTaskId}
              onDayClick={handleDayDrillDown}
              onWeekChange={handleWeekChange}
            />
          ) : (
            <DayDetailPanel
              date={selectedDate}
              tasks={tasks}
              events={events}
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
