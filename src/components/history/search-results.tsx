'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task, Issue } from '@/lib/types';
import { searchTasks } from '@/lib/search';
import { STATUS_COLORS } from '@/lib/constants';
import { ChevronRight, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface SearchResultsProps {
  tasks: Task[];
  issues?: Issue[];
  query: string;
  onTaskClick: (taskId: string) => void;
  onDayClick?: (date: string) => void;
  onClearSearch?: () => void;
}

function statusBadgeLabel(status: Task['status']): string {
  // Display label mapping — keep most as-is, but '등록' reads better as '인박스' here.
  if (status === '등록') return '인박스';
  return status;
}

export function SearchResults({ tasks, issues = [], query, onTaskClick, onDayClick, onClearSearch }: SearchResultsProps) {
  const results = useMemo(() => searchTasks(tasks, query), [tasks, query]);

  const issueMap = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues) m.set(i.id, i);
    return m;
  }, [issues]);

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
      <EmptyState
        icon={SearchX}
        title={`'${query}'에 대한 결과가 없습니다`}
        description="다른 키워드로 검색해 보세요"
        action={onClearSearch ? { label: '검색 지우기', onClick: onClearSearch } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {byDate.map(([date, group]) => {
        const dateLabel = format(new Date(date + 'T00:00:00'), 'yyyy년 M월 d일 (EEEE)', { locale: ko });
        return (
          <section key={date}>
            {onDayClick ? (
              <button
                type="button"
                onClick={() => onDayClick(date)}
                className="group flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                aria-label={`${dateLabel} 일별 보기로 전환`}
              >
                <span>{dateLabel}</span>
                <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                {dateLabel}
              </h4>
            )}
            <div className="space-y-1">
              {group.map(t => {
                const issue = t.issue_id ? issueMap.get(t.issue_id) : null;
                const ts = t.completed_at ?? t.created_at;
                const timeLabel = ts ? format(new Date(ts), 'HH:mm') : null;
                const statusColor = STATUS_COLORS[t.status];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTaskClick(t.id)}
                    title={t.description || t.title}
                    className="w-full text-left px-3 py-2 rounded-md border bg-card hover:bg-accent/50 hover:border-foreground/20 transition-colors"
                  >
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5" title={t.description}>
                        {t.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: statusColor }}
                          aria-hidden="true"
                        />
                        {statusBadgeLabel(t.status)}
                      </span>
                      {issue && (
                        <span className="truncate" title={issue.name}>· {issue.name}</span>
                      )}
                      {timeLabel && (
                        <span className="ml-auto font-mono tabular-nums shrink-0">{timeLabel}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
