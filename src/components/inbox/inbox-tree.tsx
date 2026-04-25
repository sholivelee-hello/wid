'use client';
/* eslint-disable react-hooks/refs -- dnd-kit's setNodeRef + reactive flags
   (isOver, isDragging) are part of its public hook API. The React 19 lint
   rule treats them as refs because of naming, but they're values designed
   to be read in render. */

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Issue, Task } from '@/lib/types';
import { buildTree, filterIncomplete, filterBySearch, countSubtasks } from '@/lib/hierarchy';
import { lockedSiblings } from '@/lib/lock-state';
import { IssueRow } from '@/components/issues/issue-row';
import {
  TaskBranch,
  TaskBranchHandlers,
  SortableTaskItem,
  taskSortId,
} from '@/components/tasks/task-branch';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  issues: Issue[];
  tasks: Task[];
  showCompleted: boolean;
  searchQuery?: string;
  taskHandlers: TaskBranchHandlers;
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
  onToggleSortMode: (issue: Issue) => void;
  onMutate: () => void;
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  editingTaskId: string | null;
  onCloseEdit: () => void;
}

const ISSUE_SORT_PREFIX = 'iss:';
const ISSUE_DROP_PREFIX = 'dropiss:';
const TASK_SORT_PREFIX = 'tsk:';
const issueSortId = (id: string) => `${ISSUE_SORT_PREFIX}${id}`;
const issueDropId = (id: string) => `${ISSUE_DROP_PREFIX}${id}`;

type ParsedId =
  | { kind: 'issue'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'issueDrop'; id: string }
  | { kind: 'unlinked' }
  | { kind: 'unknown' };

function parseDndId(raw: string): ParsedId {
  if (raw === 'unlinked') return { kind: 'unlinked' };
  if (raw.startsWith(ISSUE_SORT_PREFIX)) return { kind: 'issue', id: raw.slice(ISSUE_SORT_PREFIX.length) };
  if (raw.startsWith(ISSUE_DROP_PREFIX)) return { kind: 'issueDrop', id: raw.slice(ISSUE_DROP_PREFIX.length) };
  if (raw.startsWith(TASK_SORT_PREFIX)) return { kind: 'task', id: raw.slice(TASK_SORT_PREFIX.length) };
  return { kind: 'unknown' };
}

function SortableIssueItem({
  id,
  dropEnabled,
  children,
}: {
  id: string;
  dropEnabled: boolean;
  children: (dragHandleSlot: React.ReactNode) => React.ReactNode;
}) {
  const sortable = useSortable({ id: issueSortId(id) });
  const droppable = useDroppable({ id: issueDropId(id), disabled: !dropEnabled });
  const setRef = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  const dragHandleSlot = (
    <button
      type="button"
      ref={sortable.setActivatorNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label="ISSUE 순서 변경"
      onClick={(e) => e.stopPropagation()}
      className="p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/issue-row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div
      ref={setRef}
      style={style}
      className={cn(
        'rounded-xl transition-shadow',
        dropEnabled && droppable.isOver && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {children(dragHandleSlot)}
    </div>
  );
}

function DroppableUnlinked() {
  const droppable = useDroppable({ id: 'unlinked' });
  const dropRef = droppable.setNodeRef;
  const isOver = droppable.isOver;
  return (
    <div
      ref={dropRef}
      className={cn(
        'rounded-xl border-2 border-dashed py-5 text-center text-xs transition-colors',
        isOver
          ? 'border-primary text-primary bg-primary/5'
          : 'border-border/60 text-muted-foreground',
      )}
    >
      {isOver
        ? '여기 떨어뜨리면 ISSUE에서 분리됩니다'
        : '드래그해서 여기 두면 독립 TASK로 분리'}
    </div>
  );
}

export function InboxTree({
  issues,
  tasks,
  showCompleted,
  searchQuery = '',
  taskHandlers,
  onEditIssue,
  onDeleteIssue,
  onToggleSortMode,
  onMutate,
  setIssues,
  setTasks,
  editingTaskId,
  onCloseEdit,
}: Props) {
  const { tree, forceOpenIssueIds, forceOpenTaskIds } = useMemo(() => {
    const built = buildTree(issues, tasks);
    const completionFiltered = showCompleted ? built : filterIncomplete(built);
    const search = filterBySearch(completionFiltered, searchQuery);
    return {
      tree: search.tree,
      forceOpenIssueIds: search.forceOpenIssueIds,
      forceOpenTaskIds: search.forceOpenTaskIds,
    };
  }, [issues, tasks, showCompleted, searchQuery]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overRaw = e.over ? String(e.over.id) : null;
    const activeRaw = String(e.active.id);
    if (!overRaw || activeRaw === overRaw) return;

    const a = parseDndId(activeRaw);
    const o = parseDndId(overRaw);

    // === ISSUE drag ===
    if (a.kind === 'issue') {
      if (o.kind === 'issue' && o.id !== a.id) {
        reorderIssues(a.id, o.id);
      }
      return;
    }

    // === TASK drag ===
    if (a.kind === 'task') {
      const dragged = tasksById.get(a.id);
      if (!dragged) return;

      // Drop on issue header → reparent to that issue (last position)
      if (o.kind === 'issueDrop') {
        if (dragged.issue_id === o.id && !dragged.parent_task_id) return;
        reparentTaskToIssueLast(dragged, o.id);
        return;
      }

      // Drop on unlinked → strip parents
      if (o.kind === 'unlinked') {
        if (dragged.issue_id === null && dragged.parent_task_id === null) return;
        unlinkTask(dragged);
        return;
      }

      // Drop on another sortable task → reorder (same parent) or reparent + insert
      if (o.kind === 'task' && o.id !== a.id) {
        const target = tasksById.get(o.id);
        if (!target) return;
        const sameParent =
          dragged.issue_id === target.issue_id &&
          dragged.parent_task_id === target.parent_task_id;
        if (sameParent) {
          reorderTasksWithinParent(dragged, target);
        } else {
          reparentTaskAtTarget(dragged, target);
        }
        return;
      }
    }
  };

  // === Mutations ===

  function reorderIssues(activeId: string, overId: string) {
    setIssues(prev => {
      const visible = prev
        .filter(i => !i.is_deleted)
        .sort((a, b) => a.position - b.position);
      const oldIndex = visible.findIndex(i => i.id === activeId);
      const newIndex = visible.findIndex(i => i.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      const reordered = arrayMove(visible, oldIndex, newIndex);
      const positionMap = new Map<string, number>();
      reordered.forEach((iss, idx) => positionMap.set(iss.id, idx));
      const next = prev.map(i =>
        positionMap.has(i.id) ? { ...i, position: positionMap.get(i.id)! } : i,
      );
      Promise.all(
        reordered.map((iss, idx) =>
          apiFetch(`/api/issues/${iss.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: idx }),
            suppressToast: true,
          }),
        ),
      ).catch(() => onMutate());
      return next;
    });
  }

  function reorderTasksWithinParent(dragged: Task, target: Task) {
    setTasks(prev => {
      const siblings = prev
        .filter(
          t =>
            !t.is_deleted &&
            t.issue_id === dragged.issue_id &&
            t.parent_task_id === dragged.parent_task_id,
        )
        .sort((a, b) => a.position - b.position);
      const oldIndex = siblings.findIndex(t => t.id === dragged.id);
      const newIndex = siblings.findIndex(t => t.id === target.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      const reordered = arrayMove(siblings, oldIndex, newIndex);
      const positionMap = new Map<string, number>();
      reordered.forEach((t, idx) => positionMap.set(t.id, idx));
      const next = prev.map(t =>
        positionMap.has(t.id) ? { ...t, position: positionMap.get(t.id)! } : t,
      );
      Promise.all(
        reordered.map((t, idx) =>
          apiFetch(`/api/tasks/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: idx }),
            suppressToast: true,
          }),
        ),
      ).catch(() => onMutate());
      return next;
    });
  }

  function reparentTaskToIssueLast(dragged: Task, issueId: string) {
    setTasks(prev => {
      // Compute next position = max + 1 in the destination issue's top-level tasks
      const targetSiblings = prev.filter(
        t =>
          !t.is_deleted &&
          t.issue_id === issueId &&
          t.parent_task_id === null &&
          t.id !== dragged.id,
      );
      const nextPos = targetSiblings.reduce((m, t) => Math.max(m, t.position), -1) + 1;
      const next = prev.map(t =>
        t.id === dragged.id
          ? { ...t, issue_id: issueId, parent_task_id: null, position: nextPos }
          : t,
      );
      apiFetch(`/api/tasks/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, parent_task_id: null, position: nextPos }),
        suppressToast: true,
      }).catch(() => onMutate());
      return next;
    });
  }

  function unlinkTask(dragged: Task) {
    setTasks(prev => {
      const indepSiblings = prev.filter(
        t =>
          !t.is_deleted &&
          t.issue_id === null &&
          t.parent_task_id === null &&
          t.id !== dragged.id,
      );
      const nextPos = indepSiblings.reduce((m, t) => Math.max(m, t.position), -1) + 1;
      const next = prev.map(t =>
        t.id === dragged.id
          ? { ...t, issue_id: null, parent_task_id: null, position: nextPos }
          : t,
      );
      apiFetch(`/api/tasks/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: null, parent_task_id: null, position: nextPos }),
        suppressToast: true,
      }).catch(() => onMutate());
      return next;
    });
  }

  function reparentTaskAtTarget(dragged: Task, target: Task) {
    setTasks(prev => {
      const newIssueId = target.issue_id;
      const newParentId = target.parent_task_id;
      const targetSiblings = prev
        .filter(
          t =>
            !t.is_deleted &&
            t.issue_id === newIssueId &&
            t.parent_task_id === newParentId &&
            t.id !== dragged.id,
        )
        .sort((a, b) => a.position - b.position);
      const insertIdx = Math.max(0, targetSiblings.findIndex(t => t.id === target.id));
      const newOrder = [...targetSiblings];
      newOrder.splice(insertIdx, 0, dragged);
      const positionMap = new Map<string, number>();
      newOrder.forEach((t, idx) => positionMap.set(t.id, idx));
      const next = prev.map(t => {
        if (t.id === dragged.id) {
          return {
            ...t,
            issue_id: newIssueId,
            parent_task_id: newParentId,
            position: positionMap.get(t.id) ?? 0,
          };
        }
        if (positionMap.has(t.id)) {
          return { ...t, position: positionMap.get(t.id)! };
        }
        return t;
      });

      // Send the reparent for the dragged task first, then update others' positions.
      apiFetch(`/api/tasks/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: newIssueId,
          parent_task_id: newParentId,
          position: positionMap.get(dragged.id),
        }),
        suppressToast: true,
      })
        .then(() =>
          Promise.all(
            newOrder
              .filter(t => t.id !== dragged.id)
              .map(t =>
                apiFetch(`/api/tasks/${t.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ position: positionMap.get(t.id) }),
                  suppressToast: true,
                }),
              ),
          ),
        )
        .catch(() => onMutate());
      return next;
    });
  }

  if (tree.issues.length === 0 && tree.independents.length === 0) {
    return null;
  }

  const issueSortableIds = tree.issues.map(({ issue }) => issueSortId(issue.id));
  const draggingTask = !!activeId && parseDndId(activeId).kind === 'task';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3">
        <SortableContext items={issueSortableIds} strategy={verticalListSortingStrategy}>
          {tree.issues.map(({ issue, tasks: nodes }) => {
            const total = nodes.length;
            const done = nodes.filter(n => n.task.status === '완료').length;
            const subCount = countSubtasks(nodes);
            const locked = lockedSiblings(nodes, issue.sort_mode);
            const taskItemIds = nodes.map(n => taskSortId(n.task.id));
            return (
              <SortableIssueItem
                key={issue.id}
                id={issue.id}
                dropEnabled={draggingTask}
              >
                {(dragHandleSlot) => (
                  <IssueRow
                    issue={issue}
                    taskCount={total}
                    doneCount={done}
                    subCount={subCount}
                    onEdit={() => onEditIssue(issue)}
                    onDelete={() => onDeleteIssue(issue)}
                    onToggleSortMode={onToggleSortMode}
                    forceOpen={forceOpenIssueIds.has(issue.id)}
                    dragHandleSlot={dragHandleSlot}
                  >
                    <SortableContext items={taskItemIds} strategy={verticalListSortingStrategy}>
                      {nodes.map(n => (
                        <SortableTaskItem key={n.task.id} id={n.task.id}>
                          {(handle) => (
                            <TaskBranch
                              node={n}
                              depth={0}
                              lockedIds={locked}
                              forceOpenIds={forceOpenTaskIds}
                              enableSortable
                              editingTaskId={editingTaskId}
                              onCloseEdit={onCloseEdit}
                              dragHandle={handle}
                              {...taskHandlers}
                            />
                          )}
                        </SortableTaskItem>
                      ))}
                    </SortableContext>
                  </IssueRow>
                )}
              </SortableIssueItem>
            );
          })}
        </SortableContext>

        {tree.independents.length > 0 && (
          <SortableContext
            items={tree.independents.map(n => taskSortId(n.task.id))}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tree.independents.map(n => (
                <SortableTaskItem key={n.task.id} id={n.task.id}>
                  {(handle) => (
                    <TaskBranch
                      node={n}
                      depth={0}
                      lockedIds={new Set<string>()}
                      forceOpenIds={forceOpenTaskIds}
                      enableSortable
                      editingTaskId={editingTaskId}
                      onCloseEdit={onCloseEdit}
                      dragHandle={handle}
                      {...taskHandlers}
                    />
                  )}
                </SortableTaskItem>
              ))}
            </div>
          </SortableContext>
        )}

        {draggingTask && <DroppableUnlinked />}
      </div>
    </DndContext>
  );
}
