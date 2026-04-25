'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Task } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskFilters } from '@/components/tasks/task-filters';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { cn } from '@/lib/utils';
import { Inbox, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDelegated, setShowDelegated] = useState(false);
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created_at'>('priority');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout>(undefined);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(() => {
    return () => { clearTimeout(searchTimerRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="task 검색"]');
        searchInput?.focus();
        searchInput?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (priority !== 'all') params.set('priority', priority);
      if (source !== 'all') params.set('source', source);
      const data = await apiFetch<Task[]>(`/api/tasks?${params}`);
      setTasks(data);
    } catch {
      // error toasted
    } finally {
      setLoading(false);
    }
  }, [priority, source]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const handler = () => fetchTasks();
    window.addEventListener('task-created', handler);
    return () => window.removeEventListener('task-created', handler);
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at } : t
    ));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('상태가 변경되었습니다');
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch {
      fetchTasks(); // revert on error
    }
  };

  const handleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task?.status === '완료' ? '대기' : '완료';
    await handleStatusChange(taskId, newStatus);
  };

  const handleDelete = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('task가 삭제되었습니다', {
        action: {
          label: '실행 취소',
          onClick: async () => {
            try {
              await apiFetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
              toast.success('task가 복구되었습니다');
              fetchTasks();
            } catch {}
          },
        },
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch {
      fetchTasks();
    }
  };

  // Filter by search
  const searchFiltered = useMemo(() => {
    if (!debouncedSearch) return tasks;
    return tasks.filter(t => t.title.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [tasks, debouncedSearch]);

  // Group tasks
  const priorityOrder: Record<string, number> = { '긴급': 0, '높음': 1, '보통': 2, '낮음': 3 };

  const actionRequired = useMemo(() => {
    const filtered = searchFiltered.filter(t => !['완료', '취소', '위임'].includes(t.status));
    return filtered.sort((a, b) => {
      if (sortBy === 'priority') return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      return b.created_at.localeCompare(a.created_at); // newest first
    });
  }, [searchFiltered, sortBy]);

  const delegatedCancelled = useMemo(() =>
    searchFiltered.filter(t => ['위임', '취소'].includes(t.status)),
    [searchFiltered]
  );

  const completedToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return searchFiltered.filter(t =>
      t.status === '완료' && t.completed_at?.startsWith(todayStr)
    );
  }, [searchFiltered]);

  if (loading && tasks.length === 0) return <TaskListSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <TaskFilters
            priority={priority}
            source={source}
            search={search}
            onPriorityChange={setPriority}
            onSourceChange={setSource}
            onSearchChange={handleSearchChange}
            showStatusFilter={false}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">정렬:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'priority' | 'deadline' | 'created_at')}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">우선순위</SelectItem>
              <SelectItem value="deadline">마감일</SelectItem>
              <SelectItem value="created_at">생성일</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {/* Action Required Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            처리 필요 <span className="text-primary">({actionRequired.length})</span>
          </h3>
          {actionRequired.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="처리할 task가 없습니다"
              description="모든 task를 처리했습니다! 새 task를 추가하거나 잠시 쉬세요."
              action={{ label: '새 task 등록', href: '/tasks/new' }}
            />
          ) : (
            <div className="space-y-2">
              {actionRequired.map((task, index) => {
                const prevTask = index > 0 ? actionRequired[index - 1] : null;
                const showNoDeadlineDivider = sortBy === 'deadline' && prevTask?.deadline && !task.deadline;

                return (
                  <div key={task.id}>
                    {showNoDeadlineDivider && (
                      <div className="flex items-center gap-2 my-2">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground">마감일 미설정</span>
                        <Separator className="flex-1" />
                      </div>
                    )}
                    <TaskCard
                      task={task}
                      onTimerChange={fetchTasks}
                      onStatusChange={handleStatusChange}
                      onComplete={handleComplete}
                      onDelete={(id) => setDeleteId(id)}
                      onSelect={setSelectedTaskId}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Today Section (collapsible) */}
        {completedToday.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              aria-expanded={showCompleted}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showCompleted && "rotate-180")} />
              오늘 완료 <span className="text-emerald-600 dark:text-emerald-400">({completedToday.length})</span>
            </button>
            {showCompleted && (
              <div className="space-y-2 opacity-60">
                {completedToday.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTimerChange={fetchTasks}
                    onStatusChange={handleStatusChange}
                    onComplete={handleComplete}
                    onDelete={(id) => setDeleteId(id)}
                    onSelect={setSelectedTaskId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delegated/Cancelled Section (collapsible) */}
        {delegatedCancelled.length > 0 && (
          <div>
            <button
              onClick={() => setShowDelegated(!showDelegated)}
              aria-expanded={showDelegated}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showDelegated && "rotate-180")} />
              위임/취소 <span className="text-muted-foreground">({delegatedCancelled.length})</span>
            </button>
            {showDelegated && (
              <div className="space-y-2 opacity-60">
                {delegatedCancelled.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTimerChange={fetchTasks}
                    onStatusChange={handleStatusChange}
                    onComplete={handleComplete}
                    onDelete={(id) => setDeleteId(id)}
                    onSelect={setSelectedTaskId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
        confirmLabel="삭제"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); setDeleteId(null); }}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchTasks}
      />
    </div>
  );
}
