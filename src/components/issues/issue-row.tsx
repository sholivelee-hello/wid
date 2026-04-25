'use client';

import Link from 'next/link';
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Lock } from 'lucide-react';
import { Issue } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Props {
  issue: Issue;
  taskCount: number;
  doneCount: number;
  subCount: number;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSortMode?: (issue: Issue) => void;
  forceOpen?: boolean;
}

export function IssueRow({
  issue,
  taskCount,
  doneCount,
  subCount,
  children,
  onEdit,
  onDelete,
  onToggleSortMode,
  forceOpen = false,
}: Props) {
  const { collapsed, toggle } = useCollapsed('issue', issue.id, false, forceOpen);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'ISSUE 펼치기' : 'ISSUE 접기'}
          className="p-1 -m-1 rounded hover:bg-accent/50 transition-colors"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              collapsed && '-rotate-90',
            )}
          />
        </button>
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: issue.color }}
          aria-hidden
        />
        <Link
          href={`/issues/${issue.id}`}
          className="font-semibold text-sm truncate hover:underline underline-offset-2"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {issue.name}
        </Link>
        {issue.deadline && (
          <span className="text-xs text-muted-foreground">
            ⏰ {formatDate(issue.deadline, 'M월 d일')}
          </span>
        )}
        {onToggleSortMode ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSortMode(issue); }}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] px-1.5 h-5 rounded-full border transition-colors',
              issue.sort_mode === 'sequential'
                ? 'border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
            title={
              issue.sort_mode === 'sequential'
                ? '순차 워크플로우 — 클릭하면 체크리스트로 전환'
                : '체크리스트 — 클릭하면 순차로 전환'
            }
            aria-label="정렬 모드 전환"
          >
            {issue.sort_mode === 'sequential' ? <Lock className="h-2.5 w-2.5" /> : null}
            {issue.sort_mode === 'sequential' ? '순차' : '체크리스트'}
          </button>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] px-1.5 h-5 rounded-full border',
              issue.sort_mode === 'sequential'
                ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                : 'border-border text-muted-foreground',
            )}
            title={
              issue.sort_mode === 'sequential'
                ? '순차 워크플로우 (이전 task가 끝나야 다음 task 잠금 해제)'
                : '체크리스트 (순서 무관)'
            }
          >
            {issue.sort_mode === 'sequential' ? <Lock className="h-2.5 w-2.5" /> : null}
            {issue.sort_mode === 'sequential' ? '순차' : '체크리스트'}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          TASK {doneCount}/{taskCount}
          {subCount > 0 ? ` · sub ${subCount}` : ''}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            aria-label="ISSUE 메뉴"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              편집
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!collapsed && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}
