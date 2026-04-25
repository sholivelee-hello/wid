'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Issue, Task } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskFilters } from '@/components/tasks/task-filters';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { useAllStatuses } from '@/lib/use-all-statuses';
import { cn } from '@/lib/utils';
import { Inbox, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { InboxTree } from '@/components/inbox/inbox-tree';
import { IssueForm } from '@/components/issues/issue-form';
import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
import { buildTree, filterIncomplete } from '@/lib/hierarchy';
import {
  loadViews, saveViews, loadInboxFilter, saveInboxFilter,
  type CustomTaskView,
} from '@/lib/custom-views';
import { ViewEditForm } from '@/components/tasks/view-edit-form';

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created_at'>('priority');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<Issue | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout>(undefined);

  const [statusFilter, setStatusFilter] = useState<string[]>(() => loadInboxFilter());

  const [customViews, setCustomViews] = useState<CustomTaskView[]>(() => loadViews('inbox'));
  const [addingView, setAddingView] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [collapsedViews, setCollapsedViews] = useState<Set<string>>(new Set());
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);

  const allStatusOptions = useAllStatuses();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(() => {
    return () => { clearTimeout(searchTimerRef.current); };
  }, []);

  useEffect(() => {
    fetch('/api/notion/sync', { method: 'POST' }).catch(() => {});
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
      const [taskData, issueData] = await Promise.all([
        apiFetch<Task[]>(`/api/tasks?${params}`),
        apiFetch<Issue[]>('/api/issues'),
      ]);
      setTasks(taskData);
      setIssues(issueData);
    } catch {
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
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at } : t
    ));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch {
      fetchTasks();
    }
  };

  const handleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task?.status === '완료' ? '대기' : '완료';
    await handleStatusChange(taskId, newStatus);
  };

  const handleDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch {
      fetchTasks();
    }
  };

  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev => {
      const next = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
      saveInboxFilter(next);
      return next;
    });
  };

  const handleAddView = (view: CustomTaskView) => {
    const next = [...customViews, view];
    setCustomViews(next);
    saveViews('inbox', next);
    setAddingView(false);
  };

  const handleEditView = (view: CustomTaskView) => {
    const next = customViews.map(v => v.id === view.id ? view : v);
    setCustomViews(next);
    saveViews('inbox', next);
    setEditingViewId(null);
  };

  const handleDeleteView = (id: string) => {
    const next = customViews.filter(v => v.id !== id);
    setCustomViews(next);
    saveViews('inbox', next);
    setDeleteViewId(null);
  };

  const toggleCollapseView = (id: string) => {
    setCollapsedViews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const priorityOrder: Record<string, number> = { '긴급': 0, '높음': 1, '보통': 2, '낮음': 3 };

  const applyBaseFilter = useCallback((list: Task[]) => {
    if (debouncedSearch) {
      list = list.filter(t => t.title.toLowerCase().includes(debouncedSearch.toLowerCase()));
    }
    return list;
  }, [debouncedSearch]);

  const treeVisibleCount = useMemo(() => {
    const built = buildTree(issues, tasks);
    const view = showCompleted ? built : filterIncomplete(built);
    let n = 0;
    for (const issueNode of view.issues) n += issueNode.tasks.length;
    n += view.independents.length;
    return n;
  }, [issues, tasks, showCompleted]);

  const getViewTasks = useCallback((view: CustomTaskView) => {
    let list = applyBaseFilter(tasks);
    if (view.statuses.length > 0) {
      list = list.filter(t => view.statuses.includes(t.status));
    }
    if ((view.priorities ?? []).length > 0) {
      list = list.filter(t => view.priorities.includes(t.priority));
    }
    const sort = view.sortBy ?? 'priority';
    return list.sort((a, b) => {
      if (sort === 'priority') return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks, applyBaseFilter]);

  const taskHandlers = {
    onTimerChange: fetchTasks,
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: (id: string) => setDeleteId(id),
    onSelect: setSelectedTaskId,
  };

  if (loading && tasks.length === 0) return <TaskListSkeleton />;

  return (
    <div className="space-y-4">
      {/* Filters */}
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">우선순위</SelectItem>
              <SelectItem value="deadline">마감일</SelectItem>
              <SelectItem value="created_at">생성일</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => { setEditingIssue(null); setAddingIssue(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            새 ISSUE
          </Button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground shrink-0">상태:</span>
        {allStatusOptions.map(({ original, display, color }) => {
          const active = statusFilter.includes(original);
          return (
            <button
              key={original}
              type="button"
              onClick={() => toggleStatusFilter(original)}
              className={cn(
                'text-[11px] h-6 px-2.5 rounded-full border transition-all',
                active
                  ? 'font-semibold'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              )}
              style={active ? { backgroundColor: `${color}20`, color, borderColor: color } : {}}
            >
              {display}
            </button>
          );
        })}
        {statusFilter.length > 0 && (
          <button
            type="button"
            onClick={() => { setStatusFilter([]); saveInboxFilter([]); }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            초기화
          </button>
        )}
      </div>

      {/* Main list (ISSUE → TASK → sub-TASK tree) */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            {showCompleted ? '전체' : '미완료'}
            <span className="text-primary ml-1.5">({treeVisibleCount})</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowCompleted(v => !v)}
          >
            {showCompleted ? '미완료만 보기' : '완료된 것도 보기'}
          </Button>
        </div>

        {addingIssue && (
          <div className="mb-3">
            <IssueForm
              onSave={(i) => {
                setIssues(prev => [...prev, i]);
                setAddingIssue(false);
              }}
              onCancel={() => setAddingIssue(false)}
            />
          </div>
        )}
        {editingIssue && (
          <div className="mb-3">
            <IssueForm
              initial={editingIssue}
              onSave={(i) => {
                setIssues(prev => prev.map(x => x.id === i.id ? i : x));
                setEditingIssue(null);
              }}
              onCancel={() => setEditingIssue(null)}
            />
          </div>
        )}

        {treeVisibleCount === 0 ? (
          <EmptyState
            icon={Inbox}
            title="해당하는 task가 없습니다"
            description="다른 필터를 선택하거나 새 task를 추가하세요."
            action={{ label: '새 task 등록', href: '/tasks/new' }}
          />
        ) : (
          <InboxTree
            issues={issues}
            tasks={tasks}
            showCompleted={showCompleted}
            taskHandlers={taskHandlers}
            onEditIssue={(i) => { setAddingIssue(false); setEditingIssue(i); }}
            onDeleteIssue={(i) => setDeletingIssue(i)}
            onMutate={fetchTasks}
          />
        )}
      </div>

      {/* Custom views */}
      {customViews.map(view => {
        const viewTasks = getViewTasks(view);
        const collapsed = collapsedViews.has(view.id);
        const isEditing = editingViewId === view.id;

        return (
          <div key={view.id}>
            <Separator className="mb-4" />
            {isEditing ? (
              <ViewEditForm
                initial={view}
                onSave={handleEditView}
                onCancel={() => setEditingViewId(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapseView(view.id)}
                    aria-expanded={!collapsed}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left group"
                  >
                    <ChevronDown className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
                      collapsed && '-rotate-90'
                    )} />
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider truncate group-hover:text-foreground transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>
                      {view.name}
                    </span>
                    <span className="text-primary text-sm">({viewTasks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingViewId(view.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="뷰 편집"
                    title="편집"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteViewId(view.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                    aria-label="뷰 삭제"
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!collapsed && (
                  <div className="space-y-2">
                    {viewTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 pl-6">해당하는 task가 없습니다.</p>
                    ) : (
                      viewTasks.map(task => (
                        <TaskCard key={task.id} task={task} {...taskHandlers} />
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Add view */}
      <div>
        <Separator className="mb-4" />
        {addingView ? (
          <ViewEditForm
            onSave={handleAddView}
            onCancel={() => setAddingView(false)}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setAddingView(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            뷰 추가
          </Button>
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

      <ConfirmDialog
        open={!!deleteViewId}
        onOpenChange={(open) => !open && setDeleteViewId(null)}
        title="뷰 삭제"
        description="이 뷰를 삭제합니다."
        confirmLabel="삭제"
        onConfirm={() => { if (deleteViewId) handleDeleteView(deleteViewId); }}
      />

      <IssueDeleteDialog
        issue={deletingIssue}
        taskCount={
          deletingIssue
            ? tasks.filter(t => t.issue_id === deletingIssue.id && !t.is_deleted).length
            : 0
        }
        onClose={() => setDeletingIssue(null)}
        onDeleted={fetchTasks}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchTasks}
      />
    </div>
  );
}
