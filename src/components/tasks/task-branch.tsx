'use client';

import { useState } from 'react';
import { TaskNode } from '@/lib/hierarchy';
import { isTaskDone, type TaskStatus } from '@/lib/types';
import { lockedSiblings, completionBlocked, incompleteChildCount } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import { ChevronDown, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { addTodayTask } from '@/lib/today-tasks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export interface TaskBranchHandlers {
  onStatusChange: (id: string, status: TaskStatus) => void;
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
  /** id of the task currently in inline-edit mode (for the whole tree). When
   *  it matches this node's task id, the card opens its inline editor. */
  editingTaskId?: string | null;
  /** Called by TaskCard's inline editor when the user closes it. */
  onCloseEdit?: () => void;
  /** Optional breadcrumb forwarded to TaskCard. Only the root TaskBranch in a
   *  flat list (e.g. Today) sets this; recursion does not propagate it. */
  breadcrumb?: { issueName?: string | null; parentTaskTitle?: string | null };
  /** Drag handle slot passed from parent SortableTaskItem. */
  dragHandle?: HandleSlot;
  /** When true, any task created via the inline AddSubTaskRow is auto-added
   *  to today's list. Today page sets this so users don't need an extra
   *  Sun-icon click after capturing a sub-task in the Today view. */
  addToTodayOnCreate?: boolean;
}

function AddSubTaskRow({
  parentId,
  addToToday = false,
}: {
  parentId: string;
  addToToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string }>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Explicit status — without this the mock-backend default used to
        // create tasks with a status outside TASK_STATUSES, which then got
        // silently filtered out of the Today page's status groups.
        body: JSON.stringify({ title: t, parent_task_id: parentId, issue_id: null, status: '등록' }),
        suppressToast: true,
      });
      if (addToToday && created?.id) addTodayTask(created.id);
      window.dispatchEvent(new CustomEvent('task-created'));
      setTitle('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/40"
      >
        <Plus className="h-3 w-3" /> 하위 task 추가
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setTitle(''); }
        }}
        placeholder="하위 task 제목"
        className="h-7 text-xs"
      />
      <Button type="button" size="sm" onClick={submit} disabled={!title.trim() || busy} className="h-7 text-xs">
        추가
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => { setOpen(false); setTitle(''); }}
        className="h-7 text-xs"
      >
        취소
      </Button>
    </div>
  );
}

export const TASK_SORT_PREFIX = 'tsk:';
export const taskSortId = (id: string) => `${TASK_SORT_PREFIX}${id}`;

interface DragHandleProps {
  ariaLabel: string;
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
  setActivatorNodeRef?: (node: HTMLElement | null) => void;
}

function DragHandle({ ariaLabel, listeners, attributes, setActivatorNodeRef }: DragHandleProps) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

interface HandleSlot {
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
  setActivatorNodeRef?: (node: HTMLElement | null) => void;
}

/** Sortable wrapper for a single TaskBranch row. Used both at the top level
 *  (by inbox-tree) and recursively here for sub-TASKs. */
export function SortableTaskItem({
  id,
  children,
}: {
  id: string;
  children: (handle: HandleSlot) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskSortId(id) });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes, setActivatorNodeRef })}
    </div>
  );
}

export function TaskBranch({
  node,
  depth,
  lockedIds,
  forceOpenIds,
  enableSortable = false,
  editingTaskId,
  onCloseEdit,
  breadcrumb,
  dragHandle,
  addToTodayOnCreate = false,
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
    ? (id: string, status: TaskStatus) => {
        // 하위 task 미완료 상태에서 부모를 처리됨(완료/위임)으로 바꾸지 못하게.
        if (isTaskDone(status)) return;
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
          editingTaskId={editingTaskId}
          onCloseEdit={onCloseEdit}
          addToTodayOnCreate={addToTodayOnCreate}
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
            {(handle) => (
              <TaskBranch
                node={child}
                depth={depth + 1}
                lockedIds={childLocked}
                forceOpenIds={forceOpenIds}
                enableSortable
                editingTaskId={editingTaskId}
                onCloseEdit={onCloseEdit}
                addToTodayOnCreate={addToTodayOnCreate}
                onStatusChange={onStatusChange}
                onComplete={onComplete}
                onDelete={onDelete}
                onSelect={onSelect}
                dragHandle={handle}
              />
            )}
          </SortableTaskItem>
        ))}
      </SortableContext>
    );
  };

  // A top-level TASK (parent_task_id === null) is the only depth at which the
  // 3-level invariant (ISSUE > TASK > sub-TASK) allows adding children. We key
  // off the model state, not the recursive `depth`, because Today-style flat
  // forests can hoist a sub-TASK to depth 0 — and we must NOT show "+ 하위
  // task 추가" on a row that already has a parent (it would 422 on MAX_DEPTH).
  const isTopLevelTask = node.task.parent_task_id === null;

  return (
    <div className="group/branch">
      <div className="group/row flex items-start gap-1">
        {dragHandle ? (
          <DragHandle
            ariaLabel="끌어서 순서 변경"
            listeners={dragHandle.listeners}
            attributes={dragHandle.attributes}
            setActivatorNodeRef={dragHandle.setActivatorNodeRef}
          />
        ) : (
          <span className="mt-3 inline-block w-[22px]" aria-hidden />
        )}
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
            isSubtask={!!node.task.parent_task_id}
            hasChildren={hasChildren}
            editing={editingTaskId === node.task.id}
            onCloseEdit={onCloseEdit}
            breadcrumb={breadcrumb}
          />
          {blocked && (
            <div className="text-[10px] text-muted-foreground ml-3 mt-1 inline-flex items-center gap-1">
              <span aria-hidden>🔒</span> 하위 task {blockedCount}개를 먼저 끝내야 해요
            </div>
          )}
          {locked && !blocked && (
            <div className="text-[10px] text-muted-foreground ml-3 mt-1 inline-flex items-center gap-1">
              <span aria-hidden>🔒</span> 앞 task가 끝나면 시작할 수 있어요
            </div>
          )}
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10px] text-muted-foreground/80 ml-3 mt-1 hover:text-foreground hover:underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              ↳ 하위 {node.children.length}개
              {node.task.sort_mode === 'sequential' ? ' · 순차' : ''}
              {collapsed ? ' · 펼치기' : ' · 접기'}
            </button>
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
            {/* Tree rail — deeper indent (24px → 32px) and a primary-tinted
              * left rail in dark mode so the parent / child relationship is
              * unmistakable. The rail color uses the primary token at low
              * alpha so it reads as "this branch belongs together" without
              * shouting. */}
            <div className="mt-1 ml-3 pl-6 border-l-2 border-border dark:border-primary/35 divide-y divide-border/80">
              {renderChildren()}
              {/* Add-sub button at the end of the children list, but only on
                * a real top-level TASK (not on a hoisted sub-TASK), and only
                * visible when this branch is hovered or focused. */}
              {isTopLevelTask && (
                <div className="pt-1.5 opacity-0 group-hover/branch:opacity-100 group-focus-within/branch:opacity-100 transition-opacity">
                  <AddSubTaskRow parentId={node.task.id} addToToday={addToTodayOnCreate} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Same gating + hover-only visibility for childless top-level TASKs. */}
      {!hasChildren && isTopLevelTask && (
        <div className="ml-[22px] mt-1 opacity-0 group-hover/branch:opacity-100 group-focus-within/branch:opacity-100 transition-opacity">
          <AddSubTaskRow parentId={node.task.id} addToToday={addToTodayOnCreate} />
        </div>
      )}
    </div>
  );
}
