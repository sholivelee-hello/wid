'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { buildTree, filterIncomplete, countSubtasks } from '@/lib/hierarchy';
import { promptNextInTodayIfNeeded } from '@/lib/today-tasks';
import { lockedSiblings } from '@/lib/lock-state';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TaskBranch } from '@/components/tasks/task-branch';
import { IssueForm } from '@/components/issues/issue-form';
import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ChevronLeft, Pencil, Trash2, Lock } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmTaskDelete, setConfirmTaskDelete] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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
    return () => window.removeEventListener('task-updated', handler);
  }, [fetchAll]);

  const tree = useMemo(() => {
    if (!issue) return null;
    const built = buildTree([issue], tasks);
    return showCompleted ? built : filterIncomplete(built);
  }, [issue, tasks, showCompleted]);

  const totals = useMemo(() => {
    const top = tasks.filter(t => !t.is_deleted && !t.parent_task_id);
    const done = top.filter(t => isTaskDone(t.status)).length;
    const subs = tasks.filter(t => !t.is_deleted && t.parent_task_id).length;
    const subDone = tasks.filter(t => !t.is_deleted && t.parent_task_id && isTaskDone(t.status)).length;
    return {
      taskTotal: top.length,
      taskDone: done,
      taskPct: top.length === 0 ? 0 : Math.round((done / top.length) * 100),
      subTotal: subs,
      subDone,
    };
  }, [tasks]);

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
      // Server may reject completion (409 INCOMPLETE_CHILDREN); leave UI untouched and refetch
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
    const next: TaskStatus = t && isTaskDone(t.status) ? '등록' : '완료';
    handleStatusChange(taskId, next);
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
    onSelect: (id: string) =>
      setEditingTaskId(prev => (prev === id ? null : id)),
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">ISSUE 로딩 중…</div>;
  }
  if (notFound || !issue) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">존재하지 않는 ISSUE입니다.</p>
        <Link href="/" className="text-sm text-primary hover:underline">← 인박스로 돌아가기</Link>
      </div>
    );
  }

  const issueNode = tree?.issues[0];
  const topNodes = issueNode?.tasks ?? [];
  const lockedTop = lockedSiblings(topNodes, issue.sort_mode);
  const subCount = countSubtasks(topNodes);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft className="h-3 w-3" />
          인박스
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
            <span className="inline-flex items-center justify-center text-[10px] font-semibold tracking-wide px-1.5 h-5 rounded-sm bg-primary/10 text-primary mt-1.5 flex-shrink-0">
              ISSUE
            </span>
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
          <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
            {issue.deadline && (
              <span>⏰ {formatDate(issue.deadline, 'yyyy년 M월 d일')}</span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 h-5 rounded-full border',
                issue.sort_mode === 'sequential'
                  ? 'border-primary/40 text-primary'
                  : 'border-border',
              )}
            >
              {issue.sort_mode === 'sequential' && <Lock className="h-2.5 w-2.5" />}
              {issue.sort_mode === 'sequential' ? '순차 워크플로우' : '체크리스트'}
            </span>
            <span>
              TASK {totals.taskDone}/{totals.taskTotal}
              {totals.subTotal > 0 && ` · sub ${totals.subDone}/${totals.subTotal}`}
            </span>
          </div>
          <div className="pl-6 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${totals.taskPct}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {totals.taskPct}%
            </span>
          </div>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {showCompleted ? '전체' : '미완료'}
          <span className="text-primary ml-1.5">
            ({topNodes.length}{subCount > 0 ? ` + sub ${subCount}` : ''})
          </span>
        </h2>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowCompleted(v => !v)}
        >
          {showCompleted ? '미완료만 보기' : '완료된 것도 보기'}
        </Button>
      </div>

      {topNodes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {showCompleted ? '이 ISSUE에 등록된 TASK가 없습니다.' : '미완료 TASK가 없습니다. 모두 완료했어요.'}
        </p>
      ) : (
        <div className="space-y-2">
          {topNodes.map(n => (
            <TaskBranch
              key={n.task.id}
              node={n}
              depth={0}
              lockedIds={lockedTop}
              editingTaskId={editingTaskId}
              onCloseEdit={() => setEditingTaskId(null)}
              {...handlers}
            />
          ))}
        </div>
      )}

      <IssueDeleteDialog
        issue={deleting ? issue : null}
        taskCount={tasks.filter(t => t.issue_id === issue.id && !t.is_deleted && !t.parent_task_id).length}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          router.push('/');
        }}
      />

      {(() => {
        const target = confirmTaskDelete
          ? tasks.find(t => t.id === confirmTaskDelete)
          : null;
        const isSub = !!target?.parent_task_id;
        return (
          <ConfirmDialog
            open={!!confirmTaskDelete}
            onOpenChange={(open) => !open && setConfirmTaskDelete(null)}
            title={isSub ? 'sub-TASK 삭제' : 'TASK 삭제'}
            description={
              isSub
                ? '이 sub-TASK를 휴지통으로 이동합니다.'
                : '이 TASK를 휴지통으로 이동합니다.'
            }
            confirmLabel="삭제"
            onConfirm={() => {
              if (confirmTaskDelete) handleDeleteTask(confirmTaskDelete);
              setConfirmTaskDelete(null);
            }}
          />
        );
      })()}

    </div>
  );
}
