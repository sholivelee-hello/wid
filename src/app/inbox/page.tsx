'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import {
  SortableTaskItem,
  taskSortId,
  TASK_SORT_PREFIX,
} from '@/components/tasks/task-branch';
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
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  INBOX_ORDER_KEY,
  loadManualOrder,
  saveManualOrder,
  applyManualOrder,
} from '@/lib/manual-order';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Inbox, ChevronDown, Plus, Pencil, Trash2, Search, X, GripVertical } from 'lucide-react';
import { PendingView } from '@/components/inbox/pending-view';
import { TrashView } from '@/components/inbox/trash-view';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { IssueForm } from '@/components/issues/issue-form';
import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
import { promptNextInTodayIfNeeded, getTodayTaskIds, removeTodayTaskWithDescendants } from '@/lib/today-tasks';
import {
  loadViews, saveViews, loadInboxFilter, saveInboxFilter,
  type CustomTaskView,
} from '@/lib/custom-views';
import { ViewEditForm } from '@/components/tasks/view-edit-form';
import { TaskQuickCapture, type TaskQuickCaptureHandle } from '@/components/tasks/task-quick-capture';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';
import { InboxFilterPopover } from '@/components/tasks/inbox-filter-popover';

// 보기 칩: 등록(기본) · 보류 · 완료 · 휴지통. URL ?view= 와 동기화.
type InboxView = 'active' | 'pending' | 'done' | 'trash';
const VIEW_VALUES: InboxView[] = ['active', 'pending', 'done', 'trash'];
function parseView(v: string | null): InboxView {
  return VIEW_VALUES.includes(v as InboxView) ? (v as InboxView) : 'active';
}

// 완료 뷰 날짜 그룹용. completed_at(없으면 created_at) ISO 문자열을 로컬 날짜로 파싱해
// 그룹 키(yyyy-MM-dd)와 사람이 읽는 라벨(오늘/어제/M월 d일/yyyy년 M월 d일)을 만든다.
function completionDayKey(t: Task): string {
  const d = new Date(t.completed_at ?? t.created_at);
  return format(d, 'yyyy-MM-dd');
}
function completionDayLabel(t: Task): string {
  const d = new Date(t.completed_at ?? t.created_at);
  if (isToday(d)) return '오늘';
  if (isYesterday(d)) return '어제';
  return format(d, isSameYear(d, new Date()) ? 'M월 d일' : 'yyyy년 M월 d일', { locale: ko });
}

export default function InboxPage() {
  return (
    <Suspense fallback={<TaskListSkeleton />}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get('view'));
  const setView = (next: InboxView) => {
    // shallow URL 갱신 — 기본(등록)은 쿼리 없음으로 깔끔하게.
    const url = next === 'active' ? '/inbox' : `/inbox?view=${next}`;
    router.replace(url, { scroll: false });
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('all');
  const [requester, setRequester] = useState('all');
  const [delegate, setDelegate] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const toggleSubs = (id: string) =>
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
  // 완료 칩 = 완료된 task만 표시 (기존 "완료한 것도 보기" 토글 대체).
  const showCompleted = view === 'done';
  // 도구바(검색+필터+정렬) 기본 접힘 — localStorage 미저장, 매번 접힘 (spec 결정 6).
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<Issue | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout>(undefined);

  const [statusFilter, setStatusFilter] = useState<string[]>(() => loadInboxFilter());

  // 오늘로 보낸 task는 등록 뷰에서 숨긴다 (사용자 요청 2026-06-04) — 오늘
  // 탭이 담당. 오늘에서 빼면 today-tasks-changed로 즉시 되살아난다.
  // explicit set만 본다: 마감 자동 포함(deadline-auto)은 사용자가 "보낸" 게
  // 아니므로 인박스에서 사라지면 오히려 혼란.
  const [todaySet, setTodaySet] = useState<Set<string>>(() => getTodayTaskIds());
  useEffect(() => {
    const handler = () => setTodaySet(getTodayTaskIds());
    window.addEventListener('today-tasks-changed', handler);
    return () => window.removeEventListener('today-tasks-changed', handler);
  }, []);

  // 드래그 수동 정렬 overlay (localStorage). 등록 뷰 + 필터 없음일 때만 적용.
  const [manualOrder, setManualOrder] = useState<string[]>(() => loadManualOrder(INBOX_ORDER_KEY));
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
        // 접힘 상태에서도 동작: 도구바를 펼친 뒤 검색 input에 포커스.
        setToolbarOpen(true);
        // 펼침 직후 input이 mount되도록 다음 프레임에서 포커스.
        requestAnimationFrame(() => {
          const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="task 검색"]');
          searchInput?.focus();
          searchInput?.select();
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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
  }, [source]);

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
      // 처리됨(완료/취소)으로 전이될 때 prompt-next 토스트 발동.
      if (isTaskDone(newStatus) && before && !isTaskDone(before.status)) {
        promptNextInTodayIfNeeded({ ...before, status: newStatus });
      }
    } catch {
      fetchTasks();
    }
  };

  const handleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    // 취소도 처리됨으로 보므로 토글 시 등록으로 되돌림.
    const newStatus: TaskStatus = task && isTaskDone(task.status) ? '등록' : '완료';
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

  const handlePend = async (taskId: string) => {
    // 낙관적 제거: 본인 + 직계 sub-task. 실패 시 fetchTasks로 원복.
    setTasks(prev => prev.filter(t => t.id !== taskId && t.parent_task_id !== taskId));
    // 보류한 task는 오늘에서도 빼낸다 — 안 그러면 복귀(unpend) 후에도 인박스가
    // today set 기준으로 계속 숨겨 "복귀가 안 된 것처럼" 보인다.
    removeTodayTaskWithDescendants(taskId, tasks);
    try {
      await apiFetch(`/api/tasks/${taskId}/pend`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('task-updated'));
      toast('보류함으로 이동했어요', {
        action: {
          label: '되돌리기',
          onClick: async () => {
            // apiFetch가 실패 토스트를 띄우고 throw하므로 여기선 재동기화만 보장.
            try {
              await apiFetch(`/api/tasks/${taskId}/unpend`, { method: 'POST' });
            } finally {
              fetchTasks();
            }
          },
        },
      });
    } catch {
      fetchTasks();
    }
  };

  // 우클릭 → ISSUE에 연결/해제. top-level TASK만 (sub-TASK는 부모 경유).
  // issue_id ↔ parent_task_id 상호배타이므로 parent 있는 task는 거절 + 안내.
  const handleLinkIssue = async (taskId: string, issueId: string | null) => {
    const target = tasks.find(t => t.id === taskId);
    if (target?.parent_task_id) {
      toast('하위 task는 부모를 통해 ISSUE에 연결돼요');
      return;
    }
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, issue_id: issueId } : t)));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId }),
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
      toast(issueId ? 'ISSUE에 연결했어요' : 'ISSUE 연결을 해제했어요');
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

  const applyBaseFilter = useCallback((list: Task[]) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      // 제목뿐 아니라 요청자/위임자 이름도 매칭 (대소문자 무시, includes).
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.requester ?? '').toLowerCase().includes(q) ||
        (t.delegate_to ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [debouncedSearch]);

  // 모든 필터 (요청자/위임자/출처/상태)는 top-level TASK 단위로
  // 매칭하고, 매칭된 부모의 sub-task는 그대로 따라온다 (3-level invariant
  // 활용 — sub-task는 source/status가 부모와 다를 수 있어
  // 그 단위로 거르면 트리가 깨진다).
  const noFilters =
    requester === 'all' &&
    delegate === 'all' &&
    source === 'all' &&
    statusFilter.length === 0;
  const treeFilteredTasks = useMemo(() => {
    if (noFilters) return tasks;
    const matchedParentIds = new Set<string>();
    for (const t of tasks) {
      if (t.parent_task_id) continue;
      const reqOk = requester === 'all' || (t.requester ?? '') === requester;
      const delOk = delegate === 'all' || (t.delegate_to ?? '') === delegate;
      const srcOk = source === 'all' || t.source === source;
      const stOk = statusFilter.length === 0 || statusFilter.includes(t.status);
      if (reqOk && delOk && srcOk && stOk) matchedParentIds.add(t.id);
    }
    return tasks.filter(t =>
      t.parent_task_id ? matchedParentIds.has(t.parent_task_id) : matchedParentIds.has(t.id),
    );
  }, [tasks, requester, delegate, source, statusFilter, noFilters]);

  // 평면 리스트 (spec 1): top-level TASK만 최신순. sub-TASK는 부모 토글로만 노출.
  const issuesById = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues) m.set(i.id, i);
    return m;
  }, [issues]);
  const subsByParent = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of treeFilteredTasks) {
      if (!t.parent_task_id || t.is_deleted) continue;
      const arr = m.get(t.parent_task_id) ?? [];
      arr.push(t);
      m.set(t.parent_task_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.position - b.position);
    return m;
  }, [treeFilteredTasks]);
  const flatTopTasks = useMemo(() => {
    const base = applyBaseFilter(treeFilteredTasks)
      .filter(t => !t.parent_task_id && !t.is_deleted)
      .filter(t => isTaskDone(t.status) === showCompleted)
      // 오늘로 보낸(explicit today) task는 등록 뷰에서 숨김 — 오늘 탭 담당.
      .filter(t => showCompleted || !todaySet.has(t.id));
    // 등록 뷰: created_at desc + 수동 정렬 overlay. 완료 뷰: completed_at desc
    // (취소 등 null은 created_at fallback). id를 2차 키로 두어 동시 생성/완료
    // 시 순서가 흔들리지 않게.
    const key = (t: Task) => (showCompleted ? (t.completed_at ?? t.created_at) : t.created_at);
    const sorted = base.sort(
      (a, b) => key(b).localeCompare(key(a)) || b.id.localeCompare(a.id),
    );
    return showCompleted ? sorted : applyManualOrder(sorted, manualOrder);
  }, [applyBaseFilter, treeFilteredTasks, showCompleted, todaySet, manualOrder]);

  // 등록 뷰에서 숨겨진 "오늘로 보낸" 미완료 top-level 수 — 리스트 아래 안내용.
  const hiddenTodayCount = useMemo(() => {
    if (showCompleted) return 0;
    return applyBaseFilter(treeFilteredTasks).filter(
      t => !t.parent_task_id && !t.is_deleted && !isTaskDone(t.status) && todaySet.has(t.id),
    ).length;
  }, [applyBaseFilter, treeFilteredTasks, showCompleted, todaySet]);
  const issueChipFor = (t: Task) => {
    if (!t.issue_id) return null;
    const i = issuesById.get(t.issue_id);
    return i ? { id: i.id, name: i.name } : null;
  };
  // 우클릭 "ISSUE에 연결" 후보 — 삭제·보류되지 않은 활성 ISSUE만.
  const linkableIssues = useMemo(
    () =>
      issues
        .filter(i => !i.is_deleted && !i.pending_at)
        .map(i => ({ id: i.id, name: i.name })),
    [issues],
  );

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

  const getViewTasks = useCallback((view: CustomTaskView) => {
    let list = applyBaseFilter(treeFilteredTasks);
    if (view.statuses.length > 0) {
      list = list.filter(t => view.statuses.includes(t.status));
    }
    const sort = view.sortBy ?? 'created_at';
    const compareStr = (a: string | null | undefined, b: string | null | undefined) => {
      const av = a?.trim() ?? '';
      const bv = b?.trim() ?? '';
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv, 'ko');
    };
    return list.sort((a, b) => {
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
    () => liveTasks.filter(t => !isTaskDone(t.status)).length,
    [liveTasks],
  );
  const dueTodayCount = useMemo(() => {
    return liveTasks.filter(t =>
      t.deadline?.slice(0, 10) === todayStr && !isTaskDone(t.status),
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
    onPend: handlePend,
    linkableIssues,
    onLinkIssue: handleLinkIssue,
  };
  const closeEdit = () => setEditingTaskId(null);

  // 드래그 핸들 슬롯 — SortableTaskItem이 내려주는 activator 바인딩.
  type RowHandle = {
    listeners: SyntheticListenerMap | undefined;
    attributes: DraggableAttributes;
    setActivatorNodeRef?: (node: HTMLElement | null) => void;
  };

  const handleListDragEnd = (e: DragEndEvent) => {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    if (!o || a === o) return;
    if (!a.startsWith(TASK_SORT_PREFIX) || !o.startsWith(TASK_SORT_PREFIX)) return;
    const ids = flatTopTasks.map(t => t.id);
    const from = ids.indexOf(a.slice(TASK_SORT_PREFIX.length));
    const to = ids.indexOf(o.slice(TASK_SORT_PREFIX.length));
    if (from === -1 || to === -1) return;
    const next = arrayMove(ids, from, to);
    setManualOrder(next);
    saveManualOrder(INBOX_ORDER_KEY, next);
  };

  const renderFlatTask = (t: Task, handle?: RowHandle) => {
    const subs = subsByParent.get(t.id) ?? [];
    const expanded = expandedSubs.has(t.id);
    const body = (
      <div key={handle ? undefined : t.id} className={cn(handle && 'flex-1 min-w-0')}>
        <TaskCard
          task={t}
          {...taskHandlers}
          issueChip={issueChipFor(t)}
          subCount={subs.length}
          subsExpanded={expanded}
          onToggleSubs={() => toggleSubs(t.id)}
          editing={editingTaskId === t.id}
          onCloseEdit={closeEdit}
        />
        {expanded && subs.length > 0 && (
          <div
            role="group"
            aria-label={`하위 task ${subs.length}개`}
            className="ml-6 pl-3 border-l-2 border-border/60 divide-y divide-border"
          >
            {subs.map(s => (
              <TaskCard
                key={s.id}
                task={s}
                {...taskHandlers}
                isSubtask
                editing={editingTaskId === s.id}
                onCloseEdit={closeEdit}
              />
            ))}
          </div>
        )}
      </div>
    );
    if (!handle) return body;
    // 핸들 있는 행: grip(hover 시 노출) + 카드. 잡아서 끌면 순서 변경.
    return (
      <div className="group/row flex items-start gap-1">
        <button
          type="button"
          ref={handle.setActivatorNodeRef}
          {...handle.attributes}
          {...handle.listeners}
          aria-label="끌어서 순서 변경"
          onClick={(e) => e.stopPropagation()}
          className="touch-none pointer-coarse:hidden mt-4 p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {body}
      </div>
    );
  };

  // 접힘 도구바에 "필터 적용 중" 점 표시용.
  const hasActiveFilter =
    source !== 'all' || statusFilter.length > 0 || requester !== 'all' || delegate !== 'all' || !!debouncedSearch;

  const VIEW_CHIPS: { value: InboxView; label: string }[] = [
    { value: 'active', label: '등록' },
    { value: 'pending', label: '보류' },
    { value: 'done', label: '완료' },
  ];

  // 보기 칩 — 모든 뷰 상단 공통.
  const viewChips = (
    <Tabs value={view} onValueChange={(v) => setView(v as InboxView)}>
      <TabsList>
        {VIEW_CHIPS.map(c => (
          <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
        ))}
        {/* 휴지통은 맨 끝 + 살짝 흐리게 + 구분선 (실수 방지). */}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border self-center" />
        <TabsTrigger value="trash" className="text-muted-foreground/70">휴지통</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  if (loading && tasks.length === 0 && (view === 'active' || view === 'done')) {
    return (
      <div className="space-y-5">
        {viewChips}
        <TaskListSkeleton />
      </div>
    );
  }

  // 보류 / 휴지통 뷰 — 추출된 컴포넌트 재사용. 칩만 위에 얹는다.
  if (view === 'pending') {
    return (
      <div className="space-y-5">
        {viewChips}
        <PendingView />
      </div>
    );
  }
  if (view === 'trash') {
    return (
      <div className="space-y-5">
        {viewChips}
        <TrashView />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {viewChips}

      {/* Compact inbox summary — two inline counts, no hero. */}
      <section className="flex items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
        <span>
          등록{' '}
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

      {/* Chrome: 기본 접힘 (spec 결정 6). 접힘 시 한 줄 — 돋보기 토글 + 새 ISSUE.
        * 펼침 시 검색 + 필터 노출. 정렬은 created_at desc 고정이라 컨트롤 없음.
        * sticky로 긴 목록에서도 따라옴. */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 bg-background/85 dark:bg-background/90 backdrop-blur-md backdrop-saturate-150 border-b border-border">
        {!toolbarOpen ? (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground hover:text-foreground relative"
              onClick={() => setToolbarOpen(true)}
              aria-label="검색·필터 열기"
            >
              <Search className="h-4 w-4 mr-1.5" />
              검색·필터
              <kbd className="ml-2 hidden sm:inline-flex text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded border pointer-events-none">⌘K</kbd>
              {/* 접혀 있어도 필터가 적용 중이면 점으로 알림. */}
              {hasActiveFilter && (
                <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
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
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                placeholder="제목·요청자 검색..."
                aria-label="task 검색"
                className="pl-8 pr-12"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded border pointer-events-none">⌘K</kbd>
            </div>
            <InboxFilterPopover
              showSort={false}
              source={source}
              statuses={statusFilter}
              requester={requester}
              delegate={delegate}
              requesters={requesters}
              delegatees={delegatees}
              onSourceChange={setSource}
              onStatusesChange={(next) => { setStatusFilter(next); saveInboxFilter(next); }}
              onRequesterChange={setRequester}
              onDelegateChange={setDelegate}
            />
            {(source !== 'all' || statusFilter.length > 0 || requester !== 'all' || delegate !== 'all') && (
              <button
                type="button"
                onClick={() => {
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
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setToolbarOpen(false)}
              aria-label="검색·필터 닫기"
            >
              <X className="h-4 w-4" />
            </Button>
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
        )}
      </div>

      {/* Main list — flat top-level TASKs, created_at desc; subs via toggle */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2
            className="text-[13px] font-semibold tracking-[-0.01em] text-foreground"
          >
            {showCompleted ? '완료' : '등록'}
          </h2>
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums px-1.5 h-5 inline-flex items-center rounded-md bg-muted/70">
            {flatTopTasks.length}
          </span>
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

        {flatTopTasks.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              debouncedSearch
                ? '검색 결과가 없어요'
                : showCompleted ? '완료한 task가 없어요' : '인박스가 비었어요'
            }
            description={
              debouncedSearch
                ? '검색어를 바꿔보거나 필터를 초기화해 보세요.'
                : showCompleted
                  ? '등록된 task를 완료하면 여기에 모여요.'
                  : '위 입력창에 한 줄로 적기만 해도 task가 생겨요.'
            }
            action={
              showCompleted
                ? undefined
                : { label: '새 task 등록하기', onClick: () => captureRef.current?.focus() }
            }
          />
        ) : showCompleted ? (
          // 완료 뷰: completed_at desc 정렬을 순회하며 날짜가 바뀔 때 그룹 헤더 삽입.
          (() => {
            let lastKey: string | null = null;
            return (
              <div>
                {flatTopTasks.map((t, idx) => {
                  const key = completionDayKey(t);
                  const isNewGroup = key !== lastKey;
                  lastKey = key;
                  return (
                    <div key={t.id}>
                      {isNewGroup && (
                        <div
                          className={cn(
                            'text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide pb-1.5 px-1',
                            idx === 0 ? 'pt-0' : 'pt-4',
                          )}
                        >
                          {completionDayLabel(t)}
                        </div>
                      )}
                      {/* 같은 그룹 내 두 번째 카드부터만 상단 구분선 (헤더가 첫 카드를 나눔). */}
                      <div className={cn(!isNewGroup && 'border-t border-border')}>
                        {renderFlatTask(t)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        ) : !hasActiveFilter ? (
          // 드래그 정렬 — 검색·필터가 없을 때만 (걸러진 리스트 위 reorder는
          // 의미가 모호해 비활성). grip을 잡아 위/아래로 끌면 순서 저장.
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleListDragEnd}
          >
            <SortableContext
              items={flatTopTasks.map(t => taskSortId(t.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border">
                {flatTopTasks.map(t => (
                  <SortableTaskItem key={t.id} id={t.id}>
                    {(handle) => renderFlatTask(t, handle)}
                  </SortableTaskItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y divide-border">
            {flatTopTasks.map(t => renderFlatTask(t))}
          </div>
        )}

        {/* 오늘로 보낸 task 숨김 안내 — 어디 갔는지 자명하게. */}
        {!showCompleted && hiddenTodayCount > 0 && (
          <p className="text-[12px] text-muted-foreground mt-3 px-1">
            오늘로 보낸 {hiddenTodayCount}개는 여기서 숨겨져 있어요 —{' '}
            <Link href="/today" className="text-primary hover:underline">
              오늘 탭에서 보기
            </Link>
            . 오늘에서 빼면 다시 나타나요.
          </p>
        )}
      </div>

      {/* Custom views — 등록(active) 뷰에서만. 완료 칩에서는 회고가 목적이라 숨김. */}
      {!showCompleted && customViews.map(customView => {
        const viewTasks = getViewTasks(customView);
        const collapsed = collapsedViews.has(customView.id);
        const isEditing = editingViewId === customView.id;

        return (
          <div key={customView.id}>
            <Separator className="mb-4" />
            {isEditing ? (
              <ViewEditForm
                initial={customView}
                onSave={handleEditView}
                onCancel={() => setEditingViewId(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapseView(customView.id)}
                    aria-expanded={!collapsed}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left group"
                  >
                    <ChevronDown className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
                      collapsed && '-rotate-90'
                    )} />
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider truncate group-hover:text-foreground transition-colors">
                      {customView.name}
                    </span>
                    <span className="text-primary text-sm">({viewTasks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingViewId(customView.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="뷰 편집"
                    title="편집"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteViewId(customView.id)}
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
      {!showCompleted && (
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
        tasks={tasks}
        issues={issues}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchTasks}
        onNavigate={(id) => setSelectedDetailTaskId(id)}
      />
    </div>
  );
}
