'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Task } from '@/lib/types';
import type { GCalEvent } from '@/lib/mock-gcal';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { TodayTimeline } from '@/components/today/today-timeline';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, ListTodo } from 'lucide-react';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, eventData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true }),
        apiFetch<GCalEvent[]>(`/api/gcal/events?from=${todayStr}&to=${todayStr}`, { suppressToast: true }),
      ]);
      setTasks(taskData);
      setEvents(eventData);
    } catch {}
    finally { setLoading(false); }
  }, [todayStr]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('task-created', handler);
    window.addEventListener('task-updated', handler);
    return () => {
      window.removeEventListener('task-created', handler);
      window.removeEventListener('task-updated', handler);
    };
  }, [fetchAll]);

  // "오늘 할 task" filter. The /api/tasks?deleted=false call already excludes
  // is_deleted tasks (API treats any value !== 'true' as false).
  const todoTasks = useMemo(() => {
    return tasks.filter(t => {
      if (['완료', '위임', '취소'].includes(t.status)) return false;
      if (t.status === '진행중') return true;
      if (t.deadline && t.deadline.slice(0, 10) <= todayStr) return true;
      if (t.started_at && t.started_at.slice(0, 10) === todayStr) return true;
      return false;
    });
  }, [tasks, todayStr]);

  const completedToday = useMemo(() => {
    return tasks.filter(t =>
      t.status === '완료' && t.completed_at?.startsWith(todayStr)
    );
  }, [tasks, todayStr]);

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
      toast.success('상태가 변경되었습니다');
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
      toast.success('task가 삭제되었습니다', {
        action: {
          label: '실행 취소',
          onClick: async () => {
            try {
              await apiFetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
              toast.success('복구되었습니다');
              fetchAll();
            } catch {}
          },
        },
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch { fetchAll(); }
  };

  const dateLabel = format(today, 'M월 d일 (EEEE)', { locale: ko });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          ☀️ 오늘, {dateLabel}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          오늘 일정 {events.length}건 · 처리할 task {todoTasks.length}건
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
          🗓️ 오늘의 일정
        </h2>
        {loading ? (
          <div className="h-40 rounded-md bg-muted/30 animate-pulse" />
        ) : (
          <TodayTimeline events={events} />
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
          📋 오늘 할 task
        </h2>
        {loading && todoTasks.length === 0 ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-md bg-muted/30 animate-pulse" />)}
          </div>
        ) : todoTasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="오늘 처리할 task가 없습니다"
            description="새 task를 추가하거나 잠시 쉬세요"
          />
        ) : (
          <div className="space-y-2">
            {todoTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onTimerChange={fetchAll}
                onStatusChange={handleStatusChange}
                onComplete={handleComplete}
                onDelete={(id) => setDeleteId(id)}
                onSelect={setSelectedTaskId}
              />
            ))}
          </div>
        )}
      </section>

      {completedToday.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            aria-expanded={showCompleted}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showCompleted && 'rotate-180')} />
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            오늘 완료 <span className="text-emerald-600 dark:text-emerald-400">({completedToday.length})</span>
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-70">
              {completedToday.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTimerChange={fetchAll}
                  onStatusChange={handleStatusChange}
                  onComplete={handleComplete}
                  onDelete={(id) => setDeleteId(id)}
                  onSelect={setSelectedTaskId}
                />
              ))}
            </div>
          )}
        </section>
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
