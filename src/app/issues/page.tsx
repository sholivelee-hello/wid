'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Issue, Task, isTaskDone } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate } from '@/lib/utils';
import { Folder } from 'lucide-react';

interface IssueStat {
  issue: Issue;
  total: number;   // 분모: 취소 제외한 직속+하위 TASK
  done: number;    // 완료 수
  allDone: boolean; // 모든 task가 종결(완료/취소) → 목록 하단으로 가라앉음
  pct: number;
}

export default function IssuesListPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [i, t] = await Promise.all([
          apiFetch<Issue[]>('/api/issues', { suppressToast: true }),
          apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true }),
        ]);
        setIssues(i);
        setTasks(t);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo<IssueStat[]>(() => {
    // issue_id로 직속+하위 TASK를 모은다. sub-TASK도 부모를 통해 같은 issue_id를
    // 직접 들고 있지 않을 수 있으므로, 부모의 issue_id를 따라가 집계한다.
    const byId = new Map<string, Task>();
    for (const t of tasks) byId.set(t.id, t);
    const resolveIssueId = (t: Task): string | null => {
      if (t.issue_id) return t.issue_id;
      if (t.parent_task_id) {
        const p = byId.get(t.parent_task_id);
        return p?.issue_id ?? null;
      }
      return null;
    };
    const grouped = new Map<string, Task[]>();
    for (const t of tasks) {
      const iid = resolveIssueId(t);
      if (!iid) continue;
      const arr = grouped.get(iid) ?? [];
      arr.push(t);
      grouped.set(iid, arr);
    }
    const result: IssueStat[] = issues.map(issue => {
      const list = grouped.get(issue.id) ?? [];
      // 분모에서 취소 제외. 완료만 분자.
      const denom = list.filter(t => t.status !== '취소');
      const done = denom.filter(t => isTaskDone(t.status)).length;
      const total = denom.length;
      const allDone = list.length > 0 && list.every(t => isTaskDone(t.status));
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      return { issue, total, done, allDone, pct };
    });
    // 정렬: 진행 중 우선 → 임박 마감순(마감 있는 것 먼저, 빠른 날짜 우선) → 최신순.
    return result.sort((a, b) => {
      if (a.allDone !== b.allDone) return a.allDone ? 1 : -1;
      const ad = a.issue.deadline, bd = b.issue.deadline;
      if (ad && bd && ad !== bd) return ad < bd ? -1 : 1;
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      return b.issue.created_at.localeCompare(a.issue.created_at);
    });
  }, [issues, tasks]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />)}
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title="아직 ISSUE가 없어요"
        description="task를 ISSUE에 연결하면 여기서 묶음으로 모아볼 수 있어요."
      />
    );
  }

  return (
    <div className="space-y-1">
      <h1 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground mb-3">이슈</h1>
      <ul className="divide-y divide-border">
        {stats.map(({ issue, total, done, allDone, pct }) => (
          <li key={issue.id}>
            <Link
              href={`/issues/${issue.id}`}
              className={cn(
                'flex items-center gap-3 px-1 py-2.5 rounded-md hover:bg-accent/30 active:bg-accent/40 transition-colors',
                allDone && 'opacity-50',
              )}
            >
              <Folder className="h-4 w-4 text-primary flex-shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 truncate text-[14px] font-medium tracking-[-0.01em]">
                {issue.name}
              </span>
              {issue.deadline && (
                <span className="text-[11px] text-primary tabular-nums whitespace-nowrap">
                  ⏰ {formatDate(issue.deadline, 'M월 d일')}
                </span>
              )}
              <span
                className="block w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`진행률 ${pct}%`}
              >
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap min-w-[42px] text-right">
                {done}<span className="text-muted-foreground/50">/</span>{total}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
