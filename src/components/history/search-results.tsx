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
