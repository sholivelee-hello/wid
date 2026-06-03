'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Issue, Task } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { issueTaskProgress } from '@/lib/hierarchy';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate } from '@/lib/utils';
import { Folder, ChevronDown } from 'lucide-react';

interface IssueStat {
  issue: Issue;
  total: number;   // 분모: 취소 제외한 직속+하위 TASK
  done: number;    // 완료 수
  allDone: boolean; // 모든 task가 종결(완료/취소) → 목록 하단으로 가라앉음
  pct: number;
}

// 진행/완료 공통 행 렌더. 두 섹션이 같은 행 마크업을 공유하도록 분리.
function IssueRow({ issue, total, done, allDone, pct }: IssueStat) {
  return (
    <li>
      <Link
        href={`/issues/${issue.id}`}
        className={cn(
          // 이름이 여러 줄로 늘어날 수 있어 상단 정렬 — 진행바/카운트를 첫 줄에 맞춘다.
          'flex items-start gap-3 px-1 py-2.5 rounded-md hover:bg-accent/30 active:bg-accent/40 transition-colors',
          allDone && 'opacity-50',
        )}
      >
        <Folder className="h-4 w-4 text-primary flex-shrink-0 mt-[2px]" aria-hidden />
        {/* 긴 이슈 이름도 잘리지 않고 끝까지 줄바꿈으로 보여준다 (사용자 요청). */}
        <span className="flex-1 min-w-0 whitespace-normal break-words text-[15px] font-medium tracking-[-0.01em]">
          {issue.name}
        </span>
        {issue.deadline && (
          <span className="text-[11px] text-primary tabular-nums whitespace-nowrap mt-[3px]">
            ⏰ {formatDate(issue.deadline, 'M월 d일')}
          </span>
        )}
        <span
          className="block w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0 mt-[7px]"
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
        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap min-w-[42px] text-right mt-[3px]">
          {done}<span className="text-muted-foreground/50">/</span>{total}
        </span>
      </Link>
    </li>
  );
}

export default function IssuesListPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // 완료 이슈 섹션은 기본 접힘. 접힘 상태는 저장하지 않음 (매번 접힘).
  const [doneOpen, setDoneOpen] = useState(false);

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
    // 직속 + (부모 경유) 하위 TASK 전부에서 집계 (취소 제외). 상세 페이지와
    // 동일 규칙을 공유 헬퍼(issueTaskProgress)로 써서 두 페이지가 어긋나지 않게.
    const result: IssueStat[] = issues.map(issue => {
      const { total, done, allDone, pct } = issueTaskProgress(issue.id, tasks);
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

  // 진행 중 / 완료 두 섹션으로 분리 (allDone 기준). stats가 이미 정렬돼 있어
  // 각 섹션 내부 정렬은 그대로 유지됨.
  const activeStats = useMemo(() => stats.filter(s => !s.allDone), [stats]);
  const doneStats = useMemo(() => stats.filter(s => s.allDone), [stats]);

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

      {activeStats.length > 0 ? (
        <ul className="divide-y divide-border">
          {activeStats.map(stat => (
            <IssueRow key={stat.issue.id} {...stat} />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2.5 text-[13px] text-muted-foreground">
          진행 중인 이슈가 없어요.
        </p>
      )}

      {doneStats.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setDoneOpen(o => !o)}
            aria-expanded={doneOpen}
            className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform flex-shrink-0',
                !doneOpen && '-rotate-90',
              )}
              aria-hidden
            />
            <span className="tabular-nums">
              완료된 이슈 {doneStats.length}개 · {doneOpen ? '접기' : '펼치기'}
            </span>
          </button>
          {doneOpen && (
            <ul className="divide-y divide-border">
              {doneStats.map(stat => (
                <IssueRow key={stat.issue.id} {...stat} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
