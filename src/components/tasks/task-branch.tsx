'use client';

import { toast } from 'sonner';
import { TaskNode } from '@/lib/hierarchy';
import { isTaskDone, type TaskStatus } from '@/lib/types';
import { lockedSiblings, completionBlocked, incompleteChildCount } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { AddSubTaskRow } from '@/components/tasks/add-sub-task-row';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import { ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  onPend?: (id: string) => void;
  /** 우클릭 "ISSUE에 연결" 후보 + 핸들러 — TaskCard로 그대로 전달.
   *  TaskCard가 top-level TASK에만 서브메뉴를 노출한다. */
  linkableIssues?: { id: string; name: string }[];
  onLinkIssue?: (taskId: string, issueId: string | null) => void;
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
  /** Reason this row appears where it does — forwarded to TaskCard. Set by the
   *  Today page on deadline-auto roots; not propagated through recursion. */
  reasonBadge?: 'deadline';
  /** 카드 2행에 표시할 소속 ISSUE 칩. 평면 리스트/Today에서 root에만 설정.
   *  recursion으로 전파하지 않는다(자식은 부모를 통해 ISSUE에 속하므로). */
  issueChip?: { id: string; name: string } | null;
  /** Drag handle slot passed from parent SortableTaskItem. */
  dragHandle?: HandleSlot;
  /** When true, any task created via the inline AddSubTaskRow is auto-added
   *  to today's list. Today page sets this so users don't need an extra
   *  Sun-icon click after capturing a sub-task in the Today view. */
  addToTodayOnCreate?: boolean;
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
      // touch-none: 하이브리드(터치+마우스) 기기에서 grip 위 손가락 드래그가
      // 스크롤로 새지 않게. coarse 포인터 전용 기기에선 grip을 숨겨 reorder 미지원
      // (spec 결정 — 폰에서 순서 변경 포기).
      className="touch-none pointer-coarse:hidden mt-3 p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
  // touchAction은 행이 아니라 DragHandle(activator)에만 (모바일 spec ①).
  // 행 전체에 걸면 터치 스크롤이 전부 죽는다 (2026-06-06 사용자 보고 버그).
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
  reasonBadge,
  issueChip,
  dragHandle,
  addToTodayOnCreate = false,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
  onPend,
  linkableIssues,
  onLinkIssue,
}: Props) {
  const forceOpen = forceOpenIds?.has(node.task.id) ?? false;
  const { collapsed, toggle } = useCollapsed('task', node.task.id, false, forceOpen);
  const blocked = completionBlocked(node);
  const locked = lockedIds.has(node.task.id);
  const childLocked = lockedSiblings(node.children, node.task.sort_mode);
  const blockedCount = incompleteChildCount(node);
  const hasChildren = node.children.length > 0;

  // blocked일 때는 onComplete를 undefined로 넘겨서 TaskCard 자체의 disabled
  // UX(opacity-50 + cursor-not-allowed + 툴팁)가 켜지게 한다. 빈 함수를 넘기면
  // TaskCard가 disabled로 인식하지 못해서 동그라미가 클릭되는 듯 보이고 아무
  // 일도 안 일어나 사용자가 혼란스러워했던 게 원인.
  const handleComplete = blocked ? undefined : onComplete;
  const handleStatusChange = blocked
    ? (id: string, status: TaskStatus) => {
        // 하위 task 미완료 상태에서 부모를 처리됨(완료/취소)으로 바꾸지 못하게.
        // silent fail 대신 toast로 이유를 알려서 사용자가 다음 액션을 알 수 있게.
        if (isTaskDone(status)) {
          toast(`하위 task ${blockedCount}개가 아직 안 끝났어요`, {
            description: '하위를 모두 처리한 뒤 부모를 처리해 주세요.',
          });
          return;
        }
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
          onPend={onPend}
          linkableIssues={linkableIssues}
          onLinkIssue={onLinkIssue}
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
                onPend={onPend}
                linkableIssues={linkableIssues}
                onLinkIssue={onLinkIssue}
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
            onPend={onPend}
            isSubtask={!!node.task.parent_task_id}
            hasChildren={hasChildren}
            editing={editingTaskId === node.task.id}
            onCloseEdit={onCloseEdit}
            breadcrumb={breadcrumb}
            reasonBadge={reasonBadge}
            issueChip={issueChip}
            linkableIssues={linkableIssues}
            onLinkIssue={onLinkIssue}
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
