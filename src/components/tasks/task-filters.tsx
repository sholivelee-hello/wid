'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { DEFAULT_STATUSES, PRIORITIES, SOURCES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';

interface TaskFiltersProps {
  status?: string;
  priority: string;
  source: string;
  onStatusChange?: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  showStatusFilter?: boolean;
}

export function TaskFilters({
  status, priority, source,
  onStatusChange, onPriorityChange, onSourceChange,
  search, onSearchChange,
  showStatusFilter = true,
}: TaskFiltersProps) {
  const hiddenStatuses = useHiddenStatuses();
  const visibleDefaults = DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s));
  return (
    <div className="flex gap-3 flex-wrap">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input
          placeholder="task 검색..."
          aria-label="task 검색"
          className="w-full sm:w-64 pl-8 pr-12"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded border pointer-events-none">⌘K</kbd>
      </div>
      {showStatusFilter && onStatusChange && (
        <Select value={status} onValueChange={(v) => onStatusChange(v ?? 'all')}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {visibleDefaults.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={priority} onValueChange={(v) => onPriorityChange(v ?? 'all')}>
        <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="우선순위" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 우선순위</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={source} onValueChange={(v) => onSourceChange(v ?? 'all')}>
        <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="출처" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
