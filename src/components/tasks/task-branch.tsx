'use client';

import { TaskNode } from '@/lib/hierarchy';
import { lockedSiblings, completionBlocked, incompleteChildCount } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface TaskBranchHandlers {
  onStatusChange: (id: string, status: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}

interface Props extends TaskBranchHandlers {
  node: TaskNode;
  depth: number;
  lockedIds: Set<string>;
  forceOpenIds?: Set<string>;
  /** When true, the children of this branch are wrapped in a SortableContext
   *  so users can drag-reorder sub-TASKs. The OUTER caller is responsible
   *  for wrapping THIS branch in a SortableTaskItem. */
  enableSortable?: boolean;
}

export const TASK_SORT_PREFIX = 'tsk:';
export const taskSortId = (id: string) => `${TASK_SORT_PREFIX}${id}`;

/** Sortable wrapper for a single TaskBranch row. Used both at the top level
 *  (by inbox-tree) and recursively here for sub-TASKs. */
export function SortableTaskItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskSortId(id) });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function TaskBranch({
  node,
  depth,
  lockedIds,
  forceOpenIds,
  enableSortable = false,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
}: Props) {
  const forceOpen = forceOpenIds?.has(node.task.id) ?? false;
  const { collapsed, toggle } = useCollapsed('task', node.task.id, false, forceOpen);
  const blocked = completionBlocked(node);
  const locked = lockedIds.has(node.task.id);
  const childLocked = lockedSiblings(node.children, node.task.sort_mode);
  const blockedCount = incompleteChildCount(node);
  const hasChildren = node.children.length > 0;

  const handleComplete = blocked
    ? () => {/* blocked: no-op */}
    : onComplete;
  const handleStatusChange = blocked
    ? (id: string, status: string) => {
        if (status === '완료') return;
        onStatusChange(id, status);
      }
    : onStatusChange;

  const renderChildren = () => {
    if (!enableSortable) {
      return node.children.map(child => (
        <TaskBranch
          key={child.task.id}
          node={child}
          depth={depth + 1}
          lockedIds={childLocked}
          forceOpenIds={forceOpenIds}
          enableSortable={false}
          onStatusChange={onStatusChange}
          onComplete={onComplete}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ));
    }
    const childIds = node.children.map(c => taskSortId(c.task.id));
    return (
      <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
        {node.children.map(child => (
          <SortableTaskItem key={child.task.id} id={child.task.id}>
            <TaskBranch
              node={child}
              depth={depth + 1}
              lockedIds={childLocked}
              forceOpenIds={forceOpenIds}
              enableSortable
              onStatusChange={onStatusChange}
              onComplete={onComplete}
              onDelete={onDelete}
              onSelect={onSelect}
            />
          </SortableTaskItem>
        ))}
      </SortableContext>
    );
  };

  return (
    <div>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={collapsed ? '하위 펼치기' : '하위 접기'}
            aria-expanded={!collapsed}
            className="mt-3 p-1 -m-1 rounded text-muted-foreground hover:bg-accent/50"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                collapsed && '-rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="mt-3 inline-block w-[22px]" aria-hidden />
        )}
        <div className={cn('flex-1 min-w-0', locked && 'opacity-60')}>
          <TaskCard
            task={node.task}
            onStatusChange={handleStatusChange}
            onComplete={handleComplete}
            onDelete={onDelete}
            onSelect={onSelect}
            hierarchyLabel={depth === 0 ? 'TASK' : 'sub-TASK'}
            onCardClick={hasChildren ? toggle : undefined}
          />
          {blocked && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400 ml-3 mt-1">
              🔒 sub-TASK {blockedCount}개 미완료 — 완료할 수 없음
            </div>
          )}
          {locked && !blocked && (
            <div className="text-[10px] text-muted-foreground ml-3 mt-1">
              🔒 이전 task 대기 중
            </div>
          )}
          {hasChildren && (
            <div className="text-[10px] text-muted-foreground/80 ml-3 mt-1">
              ↳ sub-TASK {node.children.length}개
              {node.task.sort_mode === 'sequential' ? ' · 순차' : ''}
            </div>
          )}
        </div>
      </div>
      {hasChildren && (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-2 ml-2 pl-4 border-l-2 border-border/50 space-y-2">
              {renderChildren()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
