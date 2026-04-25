'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek } from 'date-fns';
import { Input } from '@/components/ui/input';
import { EventMonthGrid } from '@/components/dashboard/event-month-grid';
import { DayDetailPanel } from '@/components/history/day-detail-panel';
import { WeekDetailPanel } from '@/components/history/week-detail-panel';
import { SearchResults } from '@/components/history/search-results';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { apiFetch } from '@/lib/api';
import { searchTasks } from '@/lib/search';
import type { Task, TimeLog } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import type { CalendarSubscription } from '@/lib/mock-calendars';
import { Search } from 'lucide-react';

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
      setTasks(t); setEvents(e); setTimeLogs(l); setSubs(s);
    } catch {}
  }, [monthCursor]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const completedCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== '완료' || !t.completed_at) continue;
      const d = t.completed_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const searchMatchDates = useMemo(() => {
    if (!debouncedSearch) return new Set<string>();
    const matches = searchTasks(tasks, debouncedSearch);
    return new Set(matches.map(t => (t.completed_at ?? t.created_at).slice(0, 10)));
  }, [tasks, debouncedSearch]);

  const clearSearch = () => { setSearch(''); setDebouncedSearch(''); };

  const gridSelectedDate = viewMode === 'week' && selectedWeekStart
    ? selectedWeekStart
    : (selectedDate ?? new Date());

  return (
    <div className="space-y-4 max-w-7xl">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        히스토리
      </h1>

      <div className="relative max-w-lg">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="task 제목/설명/요청자/위임대상 검색..."
          aria-label="task 검색"
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <EventMonthGrid
            selectedDate={gridSelectedDate}
            monthCursor={monthCursor}
            onMonthChange={setMonthCursor}
            onWeekSelect={(d) => {
              if (debouncedSearch) clearSearch();
              setSelectedWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
              setViewMode('week');
            }}
            onDaySelect={(d) => {
              if (debouncedSearch) clearSearch();
              setSelectedDate(d);
              setViewMode('day');
            }}
            events={events.filter(e => e.calendarId === 'me')}
            completedCountByDate={completedCountByDate}
            searchHighlightDates={searchMatchDates}
          />
        </div>

        <div className="border rounded-lg p-4 bg-card min-h-[400px]">
          {debouncedSearch ? (
            <SearchResults tasks={tasks} query={debouncedSearch} onTaskClick={setSelectedTaskId} />
          ) : viewMode === 'week' ? (
            <WeekDetailPanel
              weekStart={selectedWeekStart}
              tasks={tasks}
              events={events}
              timeLogs={timeLogs}
              subscriptions={subs}
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
