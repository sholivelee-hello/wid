'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Task } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUSES } from '@/lib/constants';
import { useAllStatuses } from '@/lib/use-all-statuses';
import { getTodayTaskIds } from '@/lib/today-tasks';
import { ChevronDown, Sun } from 'lucide-react';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [todayIds, setTodayIds] = useState<Set<string>>(() => getTodayTaskIds());

  const allStatuses = useAllStatuses();

  const today = new Date();
  const dateLabel = format(today, 'M월 d일 (EEEE)', { locale: ko });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const taskData = await apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true });
      setTasks(taskData);
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

  // 오늘에 추가된 task들
  const todayTasks = useMemo(() =>
    tasks.filter(t => todayIds.has(t.id)),
    [tasks, todayIds]
  );

  // 상태별 그룹핑 (DEFAULT_STATUSES 순서 우선, 커스텀 상태 뒤에)
  const statusGroups = useMemo(() => {
    const statusOrder = [
      ...DEFAULT_STATUSES,
      ...allStatuses.filter(s => s.isCustom).map(s => s.original),
    ];
    const groups = new Map<string, Task[]>();
    for (const status of statusOrder) {
      const group = todayTasks.filter(t => t.status === status);
      if (group.length > 0) groups.set(status, group);
    }
    // 혹시 statusOrder에 없는 상태 처리
    for (const task of todayTasks) {
      if (!groups.has(task.status)) {
        groups.set(task.status, [task]);
      }
    }
    return groups;
  }, [todayTasks, allStatuses]);

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
    onTimerChange: fetchAll,
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: (id: string) => setDeleteId(id),
    onSelect: setSelectedTaskId,
  };

  const getStatusDisplay = (status: string) =>
    allStatuses.find(s => s.original === status)?.display ?? status;

  const getStatusColor = (status: string) =>
    allStatuses.find(s => s.original === status)?.color ?? '#6B7280';

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
          {[...statusGroups.entries()].map(([status, groupTasks]) => {
            const collapsed = collapsedGroups.has(status);
            const color = getStatusColor(status);
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
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {display}
                  </span>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    ({groupTasks.length})
                  </span>
                </button>
                {!collapsed && (
                  <div className="space-y-2">
                    {groupTasks.map(task => (
                      <TaskCard key={task.id} task={task} {...taskHandlers} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchAll}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
        confirmLabel="삭제"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
