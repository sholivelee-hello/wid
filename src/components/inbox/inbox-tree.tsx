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
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { Issue, Task } from '@/lib/types';
import { buildTree, filterIncomplete, countSubtasks } from '@/lib/hierarchy';
import { lockedSiblings } from '@/lib/lock-state';
import { IssueRow } from '@/components/issues/issue-row';
import { TaskBranch, TaskBranchHandlers } from '@/components/tasks/task-branch';
import { apiFetch } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  issues: Issue[];
  tasks: Task[];
  showCompleted: boolean;
  taskHandlers: TaskBranchHandlers;
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
  onMutate: () => void;
}

interface MergeRequest {
  aId: string;
  bId: string;
  aTitle: string;
  bTitle: string;
}

function DroppableIssue({
  id,
  children,
  enabled,
}: {
  id: string;
  children: React.ReactNode;
  enabled: boolean;
}) {
  const droppable = useDroppable({ id, disabled: !enabled });
  const dropRef = droppable.setNodeRef;
  const isOver = droppable.isOver;
  return (
    <div
      ref={dropRef}
      className={cn(
        'rounded-xl transition-shadow',
        enabled && isOver && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {children}
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

function DraggableTaskBranch({
  taskId,
  mergeTarget,
  children,
}: {
  taskId: string;
  mergeTarget: boolean;
  children: React.ReactNode;
}) {
  const draggable = useDraggable({ id: taskId });
  const droppable = useDroppable({ id: `merge:${taskId}`, disabled: !mergeTarget });
  const dragRef = draggable.setNodeRef;
  const dropRef = droppable.setNodeRef;
  const transform = draggable.transform;
  const isDragging = draggable.isDragging;
  const isOver = droppable.isOver;
  return (
    <div
      ref={dropRef}
      className={cn(
        'rounded-xl transition-colors',
        mergeTarget && isOver && 'ring-2 ring-amber-400 bg-amber-50/30 dark:bg-amber-900/10',
      )}
    >
      <div
        ref={dragRef}
        {...draggable.attributes}
        {...draggable.listeners}
        style={{
          transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
          opacity: isDragging ? 0.4 : 1,
          touchAction: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MergePrompt({
  request,
  onClose,
  onConfirm,
}: {
  request: MergeRequest | null;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!request) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onConfirm(name.trim());
    } finally {
      setBusy(false);
      setName('');
    }
  };

  return (
    <Dialog
      open={!!request}
      onOpenChange={(v) => {
        if (!v) {
          setName('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>두 TASK를 새 ISSUE로 묶기</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{request.aTitle}</span> +{' '}
            <span className="font-medium text-foreground">{request.bTitle}</span>를{' '}
            묶을 ISSUE 이름을 입력하세요.
          </p>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ISSUE 이름"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InboxTree({
  issues,
  tasks,
  showCompleted,
  taskHandlers,
  onEditIssue,
  onDeleteIssue,
  onMutate,
}: Props) {
  const tree = useMemo(() => {
    const built = buildTree(issues, tasks);
    return showCompleted ? built : filterIncomplete(built);
  }, [issues, tasks, showCompleted]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mergeRequest, setMergeRequest] = useState<MergeRequest | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
    const draggedId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const dragged = tasksById.get(draggedId);
    if (!dragged) return;

    if (overId.startsWith('issue:')) {
      const targetIssueId = overId.slice('issue:'.length);
      if (dragged.issue_id === targetIssueId && !dragged.parent_task_id) return;
      try {
        await apiFetch(`/api/tasks/${draggedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue_id: targetIssueId,
            parent_task_id: null,
          }),
          suppressToast: true,
        });
        onMutate();
      } catch {}
      return;
    }

    if (overId === 'unlinked') {
      if (dragged.issue_id === null && dragged.parent_task_id === null) return;
      try {
        await apiFetch(`/api/tasks/${draggedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue_id: null,
            parent_task_id: null,
          }),
          suppressToast: true,
        });
        onMutate();
      } catch {}
      return;
    }

    if (overId.startsWith('merge:')) {
      const otherId = overId.slice('merge:'.length);
      if (otherId === draggedId) return;
      const other = tasksById.get(otherId);
      if (!other) return;
      // Merge only when both are independent (no issue, no parent)
      if (dragged.issue_id || dragged.parent_task_id) return;
      if (other.issue_id || other.parent_task_id) return;
      setMergeRequest({
        aId: draggedId,
        bId: otherId,
        aTitle: dragged.title,
        bTitle: other.title,
      });
      return;
    }
  };

  const handleMerge = async (name: string) => {
    if (!mergeRequest) return;
    try {
      const issue = await apiFetch<Issue>('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        suppressToast: true,
      });
      await Promise.all([
        apiFetch(`/api/tasks/${mergeRequest.aId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: issue.id, parent_task_id: null }),
          suppressToast: true,
        }),
        apiFetch(`/api/tasks/${mergeRequest.bId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: issue.id, parent_task_id: null }),
          suppressToast: true,
        }),
      ]);
      onMutate();
    } catch {}
    setMergeRequest(null);
  };

  if (tree.issues.length === 0 && tree.independents.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3">
        {tree.issues.map(({ issue, tasks: nodes }) => {
          const total = nodes.length;
          const done = nodes.filter(n => n.task.status === '완료').length;
          const subCount = countSubtasks(nodes);
          const locked = lockedSiblings(nodes, issue.sort_mode);
          // Reparent enabled when dragging — but also active drop check excludes
          // dropping back onto its own issue (handled in onDragEnd).
          const reparentEnabled = !!activeId;
          return (
            <DroppableIssue
              key={issue.id}
              id={`issue:${issue.id}`}
              enabled={reparentEnabled}
            >
              <IssueRow
                issue={issue}
                taskCount={total}
                doneCount={done}
                subCount={subCount}
                onEdit={() => onEditIssue(issue)}
                onDelete={() => onDeleteIssue(issue)}
              >
                {nodes.map(n => (
                  <DraggableTaskBranch
                    key={n.task.id}
                    taskId={n.task.id}
                    mergeTarget={false}
                  >
                    <TaskBranch
                      node={n}
                      depth={0}
                      lockedIds={locked}
                      {...taskHandlers}
                    />
                  </DraggableTaskBranch>
                ))}
              </IssueRow>
            </DroppableIssue>
          );
        })}
        {tree.independents.length > 0 && (
          <div className="space-y-2">
            {tree.independents.map(n => (
              <DraggableTaskBranch
                key={n.task.id}
                taskId={n.task.id}
                mergeTarget
              >
                <TaskBranch
                  node={n}
                  depth={0}
                  lockedIds={new Set<string>()}
                  {...taskHandlers}
                />
              </DraggableTaskBranch>
            ))}
          </div>
        )}
        {activeId && <DroppableUnlinked />}
      </div>

      <MergePrompt
        request={mergeRequest}
        onClose={() => setMergeRequest(null)}
        onConfirm={handleMerge}
      />
    </DndContext>
  );
}
