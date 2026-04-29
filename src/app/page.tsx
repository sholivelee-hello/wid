'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Inbox, ChevronDown, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { InboxTree } from '@/components/inbox/inbox-tree';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { IssueForm } from '@/components/issues/issue-form';
import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
import { buildTree, filterIncomplete } from '@/lib/hierarchy';
import { promptNextInTodayIfNeeded } from '@/lib/today-tasks';
import {
  loadViews, saveViews, loadInboxFilter, saveInboxFilter,
  loadInboxSort, saveInboxSort, SORT_LABEL,
  type CustomTaskView, type SortKey,
} from '@/lib/custom-views';
import { ViewEditForm } from '@/components/tasks/view-edit-form';
import { TaskQuickCapture, type TaskQuickCaptureHandle } from '@/components/tasks/task-quick-capture';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';
import { InboxFilterPopover } from '@/components/tasks/inbox-filter-popover';

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState('all');
  const [source, setSource] = useState('all');
  const [requester, setRequester] = useState('all');
  const [delegate, setDelegate] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortByRaw] = useState<SortKey>(() => loadInboxSort());
  const setSortBy = (v: SortKey) => { setSortByRaw(v); saveInboxSort(v); };
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
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

  const captureRef = useRef<TaskQuickCaptureHandle>(null);
  const { registerInlineFocus } = useQuickCapture();
  useEffect(() => {
    registerInlineFocus(() => captureRef.current?.focus());
    return () => registerInlineFocus(null);
  }, [registerInlineFocus]);

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
    window.addEventListener('task-updated', handler);
    return () => {
      window.removeEventListener('task-created', handler);
      window.removeEventListener('task-updated', handler);
    };
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const before = tasks.find(t => t.id === taskId);
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
      // 처리됨(완료/위임)으로 전이될 때 prompt-next 토스트 발동.
      if (isTaskDone(newStatus) && before && !isTaskDone(before.status)) {
        promptNextInTodayIfNeeded({ ...before, status: newStatus });
      }
    } catch {
      fetchTasks();
    }
  };

  const handleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    // 위임도 처리됨으로 보므로 토글 시 등록으로 되돌림.
    const newStatus: TaskStatus = task && isTaskDone(task.status) ? '등록' : '완료';
    await handleStatusChange(taskId, newStatus);
  };

  const handleToggleSortMode = async (issue: Issue) => {
    const next = issue.sort_mode === 'sequential' ? 'checklist' : 'sequential';
    setIssues(prev => prev.map(x => x.id === issue.id ? { ...x, sort_mode: next } : x));
    try {
      const updated = await apiFetch<Issue>(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_mode: next }),
      });
      setIssues(prev => prev.map(x => x.id === issue.id ? updated : x));
    } catch {
      fetchTasks();
    }
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

  // 모든 필터 (요청자/위임자/우선순위/출처/상태)는 top-level TASK 단위로
  // 매칭하고, 매칭된 부모의 sub-task는 그대로 따라온다 (3-level invariant
  // 활용 — sub-task는 보통 본인 priority/source/status가 부모와 다를 수 있어
  // 그 단위로 거르면 트리가 깨진다).
  const noFilters =
    requester === 'all' &&
    delegate === 'all' &&
    priority === 'all' &&
    source === 'all' &&
    statusFilter.length === 0;
  const treeFilteredTasks = useMemo(() => {
    if (noFilters) return tasks;
    const matchedParentIds = new Set<string>();
    for (const t of tasks) {
      if (t.parent_task_id) continue;
      const reqOk = requester === 'all' || (t.requester ?? '') === requester;
      const delOk = delegate === 'all' || (t.delegate_to ?? '') === delegate;
      const prioOk = priority === 'all' || t.priority === priority;
      const srcOk = source === 'all' || t.source === source;
      const stOk = statusFilter.length === 0 || statusFilter.includes(t.status);
      if (reqOk && delOk && prioOk && srcOk && stOk) matchedParentIds.add(t.id);
    }
    return tasks.filter(t =>
      t.parent_task_id ? matchedParentIds.has(t.parent_task_id) : matchedParentIds.has(t.id),
    );
  }, [tasks, requester, delegate, priority, source, statusFilter, noFilters]);

  // 필터 chip 후보군은 실제 task에서 추출 (sub-task 포함).
  const requesters = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const v = t.requester?.trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [tasks]);
  const delegatees = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const v = t.delegate_to?.trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const treeVisibleCount = useMemo(() => {
    const built = buildTree(issues, treeFilteredTasks);
    const view = showCompleted ? built : filterIncomplete(built);
    let n = 0;
    for (const issueNode of view.issues) n += issueNode.tasks.length;
    n += view.independents.length;
    return n;
  }, [issues, treeFilteredTasks, showCompleted]);

  const getViewTasks = useCallback((view: CustomTaskView) => {
    let list = applyBaseFilter(treeFilteredTasks);
    if (view.statuses.length > 0) {
      list = list.filter(t => view.statuses.includes(t.status));
    }
    if ((view.priorities ?? []).length > 0) {
      list = list.filter(t => view.priorities.includes(t.priority));
    }
    const sort = view.sortBy ?? 'priority';
    const compareStr = (a: string | null | undefined, b: string | null | undefined) => {
      const av = a?.trim() ?? '';
      const bv = b?.trim() ?? '';
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv, 'ko');
    };
    return list.sort((a, b) => {
      if (sort === 'priority') return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (sort === 'title') return compareStr(a.title, b.title);
      if (sort === 'requester') return compareStr(a.requester, b.requester);
      if (sort === 'source') return compareStr(a.source, b.source);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks, applyBaseFilter]);

  // Capture wall-clock once on mount so today doesn't drift between renders.
  // Must be declared before the early-return below to satisfy rules-of-hooks.
  const [{ todayStr }] = useState(() => ({
    todayStr: new Date().toISOString().slice(0, 10),
  }));

  // Inbox snapshot — only counts non-deleted, non-completed top-level work.
  const liveTasks = useMemo(() => tasks.filter(t => !t.is_deleted), [tasks]);
  const incompleteCount = useMemo(
    () => liveTasks.filter(t => !isTaskDone(t.status) && t.status !== '취소').length,
    [liveTasks],
  );
  const dueTodayCount = useMemo(() => {
    return liveTasks.filter(t =>
      t.deadline?.slice(0, 10) === todayStr && !isTaskDone(t.status) && t.status !== '취소',
    ).length;
  }, [liveTasks, todayStr]);

  const taskHandlers = {
    onStatusChange: handleStatusChange,
    onComplete: handleComplete,
    onDelete: (id: string) => setDeleteId(id),
    // Click semantics unified with Today: opening the full TaskDetailPanel
    // (center modal) gives parent / siblings / children context in one
    // surface. The legacy inline editor still exists in TaskCard but is no
    // longer reached from this list.
    onSelect: (id: string) => setSelectedDetailTaskId(id),
  };
  const closeEdit = () => setEditingTaskId(null);

  if (loading && tasks.length === 0) return <TaskListSkeleton />;

  return (
    <div className="space-y-5">
      {/* Compact inbox summary — two inline counts, no hero. */}
      <section className="flex items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
        <span>
          진행 중{' '}
          <strong className="font-semibold text-foreground tracking-[-0.01em]">
            {incompleteCount}
          </strong>
        </span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span>
          오늘 마감{' '}
          <strong
            className={cn(
              'font-semibold tracking-[-0.01em]',
              dueTodayCount > 0 ? 'text-primary' : 'text-foreground',
            )}
          >
            {dueTodayCount}
          </strong>
        </span>
      </section>

      {/* Quick capture composer (persistent inline) */}
      <TaskQuickCapture
        ref={captureRef}
        surface="inline"
        onCreated={(t) => setTasks(prev => [t, ...prev])}
      />

      {/* Chrome: search + filter popover + sort label + new ISSUE — sticky for long lists.
        * Dark-first: stronger backdrop tint so it actually hides scrolled content. */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 bg-background/85 dark:bg-background/90 backdrop-blur-md backdrop-saturate-150 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="task 검색..."
            aria-label="task 검색"
            className="pl-8 pr-12"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded border pointer-events-none">⌘K</kbd>
        </div>
        <InboxFilterPopover
          sort={sortBy}
          priority={priority}
          source={source}
          statuses={statusFilter}
          requester={requester}
          delegate={delegate}
          requesters={requesters}
          delegatees={delegatees}
          onSortChange={setSortBy}
          onPriorityChange={setPriority}
          onSourceChange={setSource}
          onStatusesChange={(next) => { setStatusFilter(next); saveInboxFilter(next); }}
          onRequesterChange={setRequester}
          onDelegateChange={setDelegate}
        />
        {(priority !== 'all' || source !== 'all' || statusFilter.length > 0 || requester !== 'all' || delegate !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setPriority('all');
              setSource('all');
              setStatusFilter([]);
              setRequester('all');
              setDelegate('all');
              saveInboxFilter([]);
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            초기화
          </button>
        )}
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          정렬: {SORT_LABEL[sortBy]}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-muted-foreground hover:text-foreground ml-auto"
          onClick={() => { setEditingIssue(null); setAddingIssue(true); }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          새 ISSUE
        </Button>
      </div>

      {/* Main list (ISSUE → TASK → sub-TASK tree) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2
            className="text-[13px] font-semibold tracking-[-0.01em] text-foreground"
          >
            {showCompleted ? '전체 task' : '진행 중'}
          </h2>
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums px-1.5 h-5 inline-flex items-center rounded-md bg-muted/70">
            {treeVisibleCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 text-[11px] text-muted-foreground hover:text-foreground rounded-full px-2.5 h-6"
            onClick={() => setShowCompleted(v => !v)}
          >
            {showCompleted ? '진행 중만 보기' : '완료한 것도 보기'}
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
            title={debouncedSearch ? '검색 결과가 없어요' : '인박스가 비었어요'}
            description={
              debouncedSearch
                ? '검색어를 바꿔보거나 필터를 초기화해 보세요.'
                : '위 입력창에 한 줄로 적기만 해도 task가 생겨요.'
            }
            action={{ label: '새 task 등록하기', onClick: () => captureRef.current?.focus() }}
          />
        ) : (
          <InboxTree
            issues={issues}
            tasks={treeFilteredTasks}
            showCompleted={showCompleted}
            searchQuery={debouncedSearch}
            sortBy={sortBy}
            taskHandlers={taskHandlers}
            onEditIssue={(i) => { setAddingIssue(false); setEditingIssue(i); }}
            onDeleteIssue={(i) => setDeletingIssue(i)}
            onToggleSortMode={handleToggleSortMode}
            onMutate={fetchTasks}
            setIssues={setIssues}
            setTasks={setTasks}
            editingTaskId={editingTaskId}
            onCloseEdit={closeEdit}
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
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider truncate group-hover:text-foreground transition-colors">
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
                        <TaskCard
                          key={task.id}
                          task={task}
                          {...taskHandlers}
                          editing={editingTaskId === task.id}
                          onCloseEdit={closeEdit}
                        />
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

      {/* Detail center modal — same pattern as Today. Surfaces parent /
        * siblings / children + full edit fields without leaving the page. */}
      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchTasks}
        onNavigate={(id) => setSelectedDetailTaskId(id)}
      />
    </div>
  );
}
