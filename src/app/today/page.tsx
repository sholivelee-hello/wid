'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Issue, Task } from '@/lib/types';
import { TaskBranch } from '@/components/tasks/task-branch';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUSES } from '@/lib/constants';
import { useAllStatuses } from '@/lib/use-all-statuses';
import { getTodayTaskIds, getEffectiveTodayTaskIds } from '@/lib/today-tasks';
import type { TaskNode } from '@/lib/hierarchy';
import { ChevronDown, Sun } from 'lucide-react';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [todayIds, setTodayIds] = useState<Set<string>>(() => getTodayTaskIds());

  const allStatuses = useAllStatuses();

  const today = new Date();
  const dateLabel = format(today, 'M월 d일 (EEEE)', { locale: ko });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, issueData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true }),
        apiFetch<Issue[]>('/api/issues', { suppressToast: true }),
      ]);
      setTasks(taskData);
      setIssues(issueData);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => {
      fetchAll();
      setTodayIds(getTodayTaskIds());
    };
    const todayHandler = () => setTodayIds(getTodayTaskIds());
    window.addEventListener('task-created', handler);
    window.addEventListener('task-updated', handler);
    window.addEventListener('today-tasks-changed', todayHandler);
    return () => {
      window.removeEventListener('task-created', handler);
      window.removeEventListener('task-updated', handler);
      window.removeEventListener('today-tasks-changed', todayHandler);
    };
  }, [fetchAll]);

  // Effective today set = explicit ids ∪ all descendants.
  const todayTasks = useMemo(() => {
    const effective = getEffectiveTodayTaskIds(todayIds, tasks);
    return tasks.filter(t => effective.has(t.id) && !t.is_deleted);
  }, [tasks, todayIds]);

  const tasksById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);
  const issuesById = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues) m.set(i.id, i);
    return m;
  }, [issues]);

  // Today-only forest: tasks whose parent is also in today nest under their
  // parent; everything else becomes a root.
  const todayForest = useMemo<TaskNode[]>(() => {
    const todaySet = new Set(todayTasks.map(t => t.id));
    const childrenByParent = new Map<string, Task[]>();
    for (const t of todayTasks) {
      if (t.parent_task_id && todaySet.has(t.parent_task_id)) {
        const arr = childrenByParent.get(t.parent_task_id) ?? [];
        arr.push(t);
        childrenByParent.set(t.parent_task_id, arr);
      }
    }
    const sortPos = (a: Task, b: Task) => a.position - b.position;
    const buildNode = (t: Task): TaskNode => ({
      task: t,
      children: (childrenByParent.get(t.id) ?? []).sort(sortPos).map(buildNode),
    });
    return todayTasks
      .filter(t => !t.parent_task_id || !todaySet.has(t.parent_task_id))
      .sort(sortPos)
      .map(buildNode);
  }, [todayTasks]);

  // Group ROOTS by status (children inside a tree keep their own status pill).
  const statusGroups = useMemo(() => {
    const order = [
      ...DEFAULT_STATUSES,
      ...allStatuses.filter(s => s.isCustom).map(s => s.original),
    ];
    const groups = new Map<string, TaskNode[]>();
    for (const status of order) {
      const g = todayForest.filter(n => n.task.status === status);
      if (g.length > 0) groups.set(status, g);
    }
    for (const root of todayForest) {
      if (!groups.has(root.task.status)) groups.set(root.task.status, [root]);
    }
    return groups;
  }, [todayForest, allStatuses]);

  const buildBreadcrumb = (task: Task) => {
    let issueName: string | null = null;
    let parentTaskTitle: string | null = null;
    if (task.parent_task_id) {
      const parent = tasksById.get(task.parent_task_id);
      parentTaskTitle = parent?.title ?? null;
      const parentIssueId = parent?.issue_id ?? null;
      if (parentIssueId) issueName = issuesById.get(parentIssueId)?.name ?? null;
    } else if (task.issue_id) {
      issueName = issuesById.get(task.issue_id)?.name ?? null;
    }
    return { issueName, parentTaskTitle };
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at }
        : t
    ));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch { fetchAll(); }
  };

  const handleComplete = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    await handleStatusChange(taskId, t?.status === '완료' ? '대기' : '완료');
  };

  const handleDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch { fetchAll(); }
  };

  const toggleGroup = (status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  const taskHandlers = {
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: (id: string) => setDeleteId(id),
    onSelect: (id: string) =>
      setEditingTaskId(prev => (prev === id ? null : id)),
  };

  const getStatusDisplay = (status: string) =>
    allStatuses.find(s => s.original === status)?.display ?? status;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          ☀️ 오늘, {dateLabel}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todayTasks.length > 0
            ? `오늘 task ${todayTasks.length}건`
            : '인박스에서 task를 "오늘에 추가"하면 여기에 표시됩니다.'}
        </p>
      </div>

      {loading && todayTasks.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-md bg-muted/30 animate-pulse" />)}
        </div>
      ) : todayTasks.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="오늘 할 task가 없습니다"
          description="인박스에서 task 카드의 ⋯ 메뉴 → '오늘에 추가'로 task를 등록하세요."
        />
      ) : (
        <div className="space-y-4">
          {[...statusGroups.entries()].map(([status, groupRoots]) => {
            const collapsed = collapsedGroups.has(status);
            const display = getStatusDisplay(status);
            return (
              <section key={status}>
                <button
                  type="button"
                  onClick={() => toggleGroup(status)}
                  aria-expanded={!collapsed}
                  className="flex items-center gap-2 w-full text-left mb-3 group"
                >
                  <ChevronDown className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
                    collapsed && '-rotate-90'
                  )} />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-border/60 text-foreground">
                    {display}
                  </span>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    ({groupRoots.length})
                  </span>
                </button>
                {!collapsed && (
                  <div className="space-y-2">
                    {groupRoots.map(root => (
                      <TaskBranch
                        key={root.task.id}
                        node={root}
                        depth={0}
                        lockedIds={new Set<string>()}
                        editingTaskId={editingTaskId}
                        onCloseEdit={() => setEditingTaskId(null)}
                        breadcrumb={buildBreadcrumb(root.task)}
                        {...taskHandlers}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {(() => {
        const target = deleteId ? tasks.find(t => t.id === deleteId) : null;
        const isSub = !!target?.parent_task_id;
        return (
          <ConfirmDialog
            open={!!deleteId}
            onOpenChange={(open) => !open && setDeleteId(null)}
            title={isSub ? 'sub-TASK 삭제' : 'TASK 삭제'}
            description={
              isSub
                ? '이 sub-TASK를 휴지통으로 이동합니다.'
                : '이 TASK를 휴지통으로 이동합니다.'
            }
            confirmLabel="삭제"
            onConfirm={() => { if (deleteId) handleDelete(deleteId); setDeleteId(null); }}
          />
        );
      })()}
    </div>
  );
}
