'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { buildTree, filterIncomplete, countSubtasks, issueTaskProgress } from '@/lib/hierarchy';
import { promptNextInTodayIfNeeded } from '@/lib/today-tasks';
import { lockedSiblings } from '@/lib/lock-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TaskBranch, SortableTaskItem, taskSortId } from '@/components/tasks/task-branch';
import { IssueForm } from '@/components/issues/issue-form';
import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { ChevronLeft, Pencil, Trash2, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmTaskDelete, setConfirmTaskDelete] = useState<string | null>(null);
  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // + 이 이슈에 task 추가
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [i, t] = await Promise.all([
        apiFetch<Issue>(`/api/issues/${id}`, { suppressToast: true }),
        apiFetch<Task[]>(`/api/issues/${id}/tasks`, { suppressToast: true }),
      ]);
      setIssue(i);
      setTasks(t);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('task-updated', handler);
    window.addEventListener('task-created', handler);
    return () => {
      window.removeEventListener('task-updated', handler);
      window.removeEventListener('task-created', handler);
    };
  }, [fetchAll]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 진행률 분모 = 직속 + (부모 경유) 하위 TASK 전부 (취소 제외).
  // 목록(/issues)과 동일 규칙을 공유 헬퍼로 집계해 두 페이지가 어긋나지 않게 한다.
  const totals = useMemo(() => {
    const { total, done, pct } = issueTaskProgress(id, tasks);
    return { taskTotal: total, taskDone: done, taskPct: pct };
  }, [id, tasks]);

  // 진행 중 / 종결 트리. buildTree로 계층을 살린 뒤 top-level 기준으로 분리.
  const { activeNodes, doneNodes, nextTask, lockedTop, subCount } = useMemo(() => {
    if (!issue) return { activeNodes: [], doneNodes: [], nextTask: null as Task | null, lockedTop: new Set<string>(), subCount: 0 };
    const built = buildTree([issue], tasks);
    const issueNode = built.issues[0];
    const all = issueNode?.tasks ?? [];
    const incompleteTree = filterIncomplete(built).issues[0]?.tasks ?? [];
    const active = incompleteTree;
    const done = all.filter(n => isTaskDone(n.task.status));
    // "다음" = position 순 첫 미완료 top-level TASK.
    const sortedActive = [...active].sort((a, b) => a.task.position - b.task.position);
    const next = sortedActive.find(n => !isTaskDone(n.task.status))?.task ?? null;
    return {
      activeNodes: sortedActive,
      doneNodes: done,
      nextTask: next,
      lockedTop: lockedSiblings(all, issue.sort_mode),
      subCount: countSubtasks(all),
    };
  }, [issue, tasks]);

  const patchTask = async (taskId: string, body: Record<string, unknown>) => {
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        suppressToast: true,
      });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch {
      fetchAll();
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const before = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at }
        : t,
    ));
    patchTask(taskId, { status: newStatus }).then(() => {
      if (isTaskDone(newStatus) && before && !isTaskDone(before.status)) {
        promptNextInTodayIfNeeded({ ...before, status: newStatus });
      }
    });
  };

  const handleComplete = (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    handleStatusChange(taskId, t && isTaskDone(t.status) ? '등록' : '완료');
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    } catch {
      fetchAll();
    }
  };

  const handlers = {
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: (taskId: string) => setConfirmTaskDelete(taskId),
    onSelect: (taskId: string) => setSelectedDetailTaskId(taskId),
  };

  // 같은 ISSUE 내 top-level TASK reorder (1-context). 계층 변경 없음.
  const handleDragEnd = (e: DragEndEvent) => {
    const activeRaw = String(e.active.id);
    const overRaw = e.over ? String(e.over.id) : null;
    if (!overRaw || activeRaw === overRaw) return;
    const aId = activeRaw.replace('tsk:', '');
    const oId = overRaw.replace('tsk:', '');
    setTasks(prev => {
      const siblings = prev
        .filter(t => !t.is_deleted && t.issue_id === id && t.parent_task_id === null)
        .sort((a, b) => a.position - b.position);
      const oldIndex = siblings.findIndex(t => t.id === aId);
      const newIndex = siblings.findIndex(t => t.id === oId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      const reordered = arrayMove(siblings, oldIndex, newIndex);
      const posMap = new Map<string, number>();
      reordered.forEach((t, idx) => posMap.set(t.id, idx));
      const next = prev.map(t => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t);
      Promise.all(
        reordered.map((t, idx) =>
          apiFetch(`/api/tasks/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: idx }),
            suppressToast: true,
          }),
        ),
      ).catch(() => fetchAll());
      return next;
    });
  };

  const createTask = async () => {
    const t = newTitle.trim();
    if (!t || creatingTask) return;
    setCreatingTask(true);
    try {
      // position 맨 아래 = 현재 top-level 최대 + 1.
      const tops = tasks.filter(x => !x.is_deleted && x.issue_id === id && x.parent_task_id === null);
      const nextPos = tops.reduce((m, x) => Math.max(m, x.position), -1) + 1;
      await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, issue_id: id, parent_task_id: null, status: '등록', position: nextPos }),
        suppressToast: true,
      });
      window.dispatchEvent(new CustomEvent('task-created'));
      setNewTitle('');
      setAdding(false);
    } finally {
      setCreatingTask(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">ISSUE 로딩 중…</div>;
  }
  if (notFound || !issue) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">존재하지 않는 ISSUE입니다.</p>
        <Link href="/issues" className="text-sm text-primary hover:underline">← 이슈 목록으로</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/issues" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft className="h-3 w-3" />
          이슈 목록
        </Link>
      </div>

      {editing ? (
        <IssueForm
          initial={issue}
          onSave={(updated) => { setIssue(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-bold leading-tight tracking-[-0.03em] flex-1 min-w-0">
              {issue.name}
            </h1>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              편집
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              삭제
            </Button>
          </div>

          {/* n/m 완료 + 큰 진행바 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{totals.taskDone}/{totals.taskTotal}</span>
              <span>완료</span>
              {subCount > 0 && <span className="text-muted-foreground/70">· 하위 {subCount}</span>}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${totals.taskPct}%` }}
              />
            </div>
          </div>

          {/* 다음 지목 */}
          {nextTask && (
            <div className="text-[13px] text-foreground/90">
              <span className="text-muted-foreground">다음: </span>
              <span className="font-medium">{nextTask.title}</span>
              {nextTask.deadline && (
                <span className="text-muted-foreground"> · 마감 {formatDate(nextTask.deadline, 'M월 d일')}</span>
              )}
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* 진행 중 목록 — 드래그 reorder는 여기서만 유지 */}
      <div className="space-y-2">
        {activeNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            진행 중인 TASK가 없습니다.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={activeNodes.map(n => taskSortId(n.task.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border">
                {activeNodes.map(n => (
                  <SortableTaskItem key={n.task.id} id={n.task.id}>
                    {(handle) => (
                      <TaskBranch
                        node={n}
                        depth={0}
                        lockedIds={lockedTop}
                        enableSortable
                        dragHandle={handle}
                        {...handlers}
                      />
                    )}
                  </SortableTaskItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* + 이 이슈에 task 추가 */}
        {adding ? (
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); createTask(); }
                else if (e.key === 'Escape') { e.preventDefault(); setAdding(false); setNewTitle(''); }
              }}
              placeholder="새 TASK 제목"
              className="h-8 text-sm"
            />
            <Button type="button" size="sm" onClick={createTask} disabled={!newTitle.trim() || creatingTask} className="h-8">
              추가
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setNewTitle(''); }} className="h-8">
              취소
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/40"
          >
            <Plus className="h-3.5 w-3.5" /> 이 이슈에 task 추가
          </button>
        )}
      </div>

      {/* 완료/취소 목록 — 아래 흐리게 */}
      {doneNodes.length > 0 && (
        <div className="space-y-2 opacity-60">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">완료·취소</h2>
          <div className="divide-y divide-border">
            {doneNodes.map(n => (
              <TaskBranch
                key={n.task.id}
                node={n}
                depth={0}
                lockedIds={new Set<string>()}
                {...handlers}
              />
            ))}
          </div>
        </div>
      )}

      <IssueDeleteDialog
        issue={deleting ? issue : null}
        taskCount={tasks.filter(t => t.issue_id === issue.id && !t.is_deleted && !t.parent_task_id).length}
        onClose={() => setDeleting(false)}
        onDeleted={() => { setDeleting(false); router.push('/issues'); }}
      />

      {(() => {
        const target = confirmTaskDelete ? tasks.find(t => t.id === confirmTaskDelete) : null;
        const isSub = !!target?.parent_task_id;
        return (
          <ConfirmDialog
            open={!!confirmTaskDelete}
            onOpenChange={(open) => !open && setConfirmTaskDelete(null)}
            title={isSub ? 'sub-TASK 삭제' : 'TASK 삭제'}
            description={isSub ? '이 sub-TASK를 휴지통으로 이동합니다.' : '이 TASK를 휴지통으로 이동합니다.'}
            confirmLabel="삭제"
            onConfirm={() => {
              if (confirmTaskDelete) handleDeleteTask(confirmTaskDelete);
              setConfirmTaskDelete(null);
            }}
          />
        );
      })()}

      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchAll}
        onNavigate={(tid) => setSelectedDetailTaskId(tid)}
      />
    </div>
  );
}
