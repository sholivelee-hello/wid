'use client';

import Link from 'next/link';
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Lock, FolderOpen } from 'lucide-react';
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
  dragHandleSlot?: React.ReactNode;
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
  dragHandleSlot,
}: Props) {
  const { collapsed, toggle } = useCollapsed('issue', issue.id, false, forceOpen);

  // % done — used for the inline progress bar shown in the section header.
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

  return (
    <section className="">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={!collapsed}
        aria-label={collapsed ? '묶음 펼치기' : '묶음 접기'}
        className="group/issue-row flex items-center gap-2 px-1 py-2 hover:bg-accent/20 active:bg-accent/30 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        {dragHandleSlot}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            collapsed && '-rotate-90',
          )}
        />
        {/* Category icon — folder makes "ISSUE = container" unmistakable on
          * scan; without it, ISSUE rows looked too similar to TASK rows. */}
        <FolderOpen
          className="h-[14px] w-[14px] text-primary flex-shrink-0"
          aria-hidden
        />
        {/* ISSUE renders as a *section label*, not as another peer row title.
          * Uppercase + 0.08em tracking + muted weight makes ISSUE read as
          * "container heading" so the TASKs underneath become the protagonists.
          * NYT-style section label pattern. */}
        <Link
          href={`/issues/${issue.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-bold text-[12px] tracking-[0.1em] uppercase truncate hover:text-foreground text-muted-foreground transition-colors"
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
              'inline-flex items-center gap-1 text-[10px] px-2 h-5 rounded-full transition-colors opacity-70 group-hover/issue-row:opacity-100',
              issue.sort_mode === 'sequential'
                ? 'bg-primary/10 text-primary hover:bg-primary/15'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            title={
              issue.sort_mode === 'sequential'
                ? '순차 워크플로 — 클릭하면 체크리스트로 전환'
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
              'inline-flex items-center gap-1 text-[10px] px-2 h-5 rounded-full',
              issue.sort_mode === 'sequential'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/60 text-muted-foreground',
            )}
            title={
              issue.sort_mode === 'sequential'
                ? '순차 워크플로 (이전 task가 끝나야 다음 task 잠금 해제)'
                : '체크리스트 (순서 무관)'
            }
          >
            {issue.sort_mode === 'sequential' ? <Lock className="h-2.5 w-2.5" /> : null}
            {issue.sort_mode === 'sequential' ? '순차' : '체크리스트'}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
            {doneCount}<span className="text-muted-foreground/50">/</span>{taskCount}
            {subCount > 0 ? <span className="text-muted-foreground/60"> · 하위 {subCount}</span> : ''}
          </span>
          {/* Inline progress bar — replaces the SaaS "ISSUE" pill with the
            * Korean-product pattern of "show progress as state, not as label".
            * Visible on all breakpoints; dark-mode bg comes from --muted token. */}
          <span
            className="block w-12 sm:w-16 h-1.5 rounded-full bg-muted overflow-hidden"
            aria-label={`진행률 ${progress}%`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span
              className={cn(
                'block h-full rounded-full transition-[width] duration-300 ease-out',
                'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
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
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="pl-5 pb-2 pt-0.5 divide-y divide-border">{children}</div>
        </div>
      </div>
    </section>
  );
}
