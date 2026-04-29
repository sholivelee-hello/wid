'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
import type { GCalEvent } from '@/lib/types';
import { TaskBranch } from '@/components/tasks/task-branch';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { TASK_STATUSES } from '@/lib/types';
import {
  getTodayTaskIds,
  getEffectiveTodayTaskIds,
  promptNextInTodayIfNeeded,
  addTodayTask,
} from '@/lib/today-tasks';
import type { TaskNode } from '@/lib/hierarchy';
import { ChevronDown, Sun, GripVertical, CalendarDays, Video, MapPin } from 'lucide-react';
import { TaskQuickCapture, type TaskQuickCaptureHandle } from '@/components/tasks/task-quick-capture';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { loadStatusOrder, saveStatusOrder, STATUS_ORDER_EVENT } from '@/lib/today-status-order';
import {
  getGCalConfig,
  getActiveCalendarIds,
  getCalendarColor,
  getCalendarLabel,
  GCAL_EMBED_EVENT,
  DEFAULT_GCAL_CONFIG,
  type GCalConfig,
} from '@/lib/gcal-embed';
import { isTokenExpired } from '@/lib/gcal-oauth';
import { fetchEventsForRange } from '@/lib/gcal-events';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface StatusSectionHandle {
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
  setActivatorNodeRef?: (n: HTMLElement | null) => void;
}

/**
 * Sortable wrapper for a Today-page status section. Exposes the activator
 * (grip) bindings via a render-prop so the section header can place the
 * grip exactly where it belongs (left of the collapse toggle), while the
 * outer wrapper handles transform/transition/dragging opacity.
 */
function SortableStatusSection({
  id,
  children,
}: {
  id: string;
  children: (handle: StatusSectionHandle) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="group/section">
      {children({ listeners, attributes, setActivatorNodeRef })}
    </div>
  );
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [todayIds, setTodayIds] = useState<Set<string>>(() => getTodayTaskIds());
  const [statusOrder, setStatusOrder] = useState<TaskStatus[]>(() => loadStatusOrder());
  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
  const [gcalConfig, setGcalConfig] = useState<GCalConfig>(DEFAULT_GCAL_CONFIG);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const captureRef = useRef<TaskQuickCaptureHandle>(null);

  // Stable today string — captured once on mount so it never drifts mid-session.
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Cross-tab + same-tab sync of the saved order.
  useEffect(() => {
    const refresh = () => setStatusOrder(loadStatusOrder());
    window.addEventListener(STATUS_ORDER_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATUS_ORDER_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // GCal config — SSR-safe: default until mount, then localStorage value.
  useEffect(() => {
    setGcalConfig(getGCalConfig());
    const handler = () => setGcalConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  // Fetch today's GCal events. Runs once on mount and whenever the config
  // changes (user connects/disconnects calendar in settings).
  const fetchGCalEvents = useCallback(async () => {
    const config = getGCalConfig();
    const activeIds = getActiveCalendarIds(config);
    const oauthValid = config.oauth !== null && !isTokenExpired(config.oauth);
    if (!oauthValid || activeIds.length === 0) {
      setGcalEvents([]);
      return;
    }
    try {
      const events = await fetchEventsForRange(
        config.oauth!.accessToken,
        activeIds,
        todayStr,
        todayStr,
      );
      setGcalEvents(events);
    } catch {
      setGcalEvents([]);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchGCalEvents();
    const handler = () => void fetchGCalEvents();
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, [fetchGCalEvents]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleStatusGroupDragEnd = (e: DragEndEvent) => {
    const activeId = e.active.id;
    const overId = e.over?.id;
    if (!overId || activeId === overId) return;
    setStatusOrder(prev => {
      const oldIndex = prev.indexOf(activeId as TaskStatus);
      const newIndex = prev.indexOf(overId as TaskStatus);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      saveStatusOrder(next);
      return next;
    });
  };

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
    const groups = new Map<string, TaskNode[]>();
    for (const status of TASK_STATUSES) {
      const g = todayForest.filter(n => n.task.status === status);
      if (g.length > 0) groups.set(status, g);
    }
    for (const root of todayForest) {
      if (!groups.has(root.task.status)) groups.set(root.task.status, [root]);
    }
    return groups;
  }, [todayForest]);

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

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const before = tasks.find(t => t.id === taskId);
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
      if (isTaskDone(newStatus) && before && !isTaskDone(before.status)) {
        promptNextInTodayIfNeeded({ ...before, status: newStatus });
      }
    } catch { fetchAll(); }
  };

  const handleComplete = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    await handleStatusChange(taskId, t && isTaskDone(t.status) ? '등록' : '완료');
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
    // Today-page click semantics differ from Inbox: opening the full
    // TaskDetailPanel surfaces the parent / siblings / requester at once,
    // which is the answer to "I see a sub-task here, where's the context?".
    // Inline editing isn't lost — it just lives behind the detail panel now.
    onSelect: (id: string) => setSelectedDetailTaskId(id),
  };

  // Lightweight progress for the header summary so the page feels alive
  // even when the list is short.
  // 위임도 본인 입장에서는 처리된 것으로 보므로 진행률에 포함.
  const completedToday = todayTasks.filter(t => isTaskDone(t.status)).length;
  const remaining = todayTasks.length - completedToday;
  const progressPct = todayTasks.length > 0
    ? Math.round((completedToday / todayTasks.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* 진행률 — 카드/큰 숫자 없이 한 줄. 토스 스타일: 핵심 지표 1개만, 작게. */}
      {todayTasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label="오늘 진행률"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[13px] font-medium tabular-nums text-muted-foreground whitespace-nowrap tracking-[-0.01em]">
            {completedToday}/{todayTasks.length}
            {remaining === 0 && <span className="ml-1.5 text-primary">완료</span>}
          </span>
        </div>
      )}

      <TaskQuickCapture
        ref={captureRef}
        surface="inline"
        onCreated={(t) => {
          addTodayTask(t.id);
          setTodayIds(getTodayTaskIds());
          setTasks(prev => [t, ...prev]);
        }}
      />

      {/* 오늘 GCal 일정 — 캘린더 연동 시에만 표시. */}
      {gcalEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground/60 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden />
            오늘 일정
          </p>
          <div className="space-y-0.5">
            {[...gcalEvents]
              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
              .map(ev => {
                const color = getCalendarColor(ev.calendarId, gcalConfig);
                const calLabel = getCalendarLabel(ev.calendarId, gcalConfig);
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/40 transition-colors text-[13px]"
                    title={calLabel}
                  >
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="text-muted-foreground tabular-nums text-[12px] min-w-[72px] shrink-0">
                      {ev.time
                        ? ev.endTime
                          ? `${ev.time} – ${ev.endTime}`
                          : ev.time
                        : '종일'}
                    </span>
                    <span className="truncate flex-1">{ev.title}</span>
                    {ev.meetLink && (
                      <a
                        href={ev.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="화상 회의 링크"
                        className="text-primary hover:text-primary/80 transition-colors shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {ev.location && !ev.meetLink && (
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-label={ev.location} />
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {loading && todayTasks.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-md bg-muted/30 animate-pulse" />)}
        </div>
      ) : todayTasks.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="오늘 할 일을 골라볼까요?"
          description="위에 한 줄 적기만 해도 오늘 할 일로 등록돼요. 또는 인박스 카드의 해 아이콘을 눌러 가져오세요."
          action={{ label: '여기서 바로 추가하기', onClick: () => captureRef.current?.focus() }}
        />
      ) : (
        // Reorderable status groups. We render in user-saved order, falling
        // through to TASK_STATUSES when missing. Empty groups are skipped so
        // the user only ever sees / re-orders sections that actually exist.
        (() => {
          const orderedStatuses = statusOrder.filter(s => statusGroups.has(s));
          return (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStatusGroupDragEnd}
            >
              <SortableContext items={orderedStatuses} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {orderedStatuses.map(status => {
                    const groupRoots = statusGroups.get(status)!;
                    const collapsed = collapsedGroups.has(status);
                    return (
                      <SortableStatusSection key={status} id={status}>
                        {(handle) => (
                          <section>
                            <div className="flex items-center gap-1.5 mb-3">
                              {/* Grip handle — only visible on hover/focus so
                                * the resting header stays clean. */}
                              <button
                                type="button"
                                ref={handle.setActivatorNodeRef}
                                {...handle.attributes}
                                {...handle.listeners}
                                aria-label={`${status} 그룹 순서 변경`}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-grab active:cursor-grabbing p-1 -m-1 rounded text-muted-foreground/50 opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 hover:bg-accent/40 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleGroup(status)}
                                aria-expanded={!collapsed}
                                className="flex items-center gap-2 flex-1 text-left group/toggle"
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
                                    collapsed && '-rotate-90',
                                  )}
                                />
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-border/60 text-foreground">
                                  {status}
                                </span>
                                <span className="text-sm text-muted-foreground group-hover/toggle:text-foreground transition-colors tabular-nums">
                                  ({groupRoots.length})
                                </span>
                              </button>
                            </div>
                            {!collapsed && (
                              <div className="divide-y divide-border">
                                {groupRoots.map(root => (
                                  <TaskBranch
                                    key={root.task.id}
                                    node={root}
                                    depth={0}
                                    lockedIds={new Set<string>()}
                                    editingTaskId={editingTaskId}
                                    onCloseEdit={() => setEditingTaskId(null)}
                                    breadcrumb={buildBreadcrumb(root.task)}
                                    addToTodayOnCreate
                                    {...taskHandlers}
                                  />
                                ))}
                              </div>
                            )}
                          </section>
                        )}
                      </SortableStatusSection>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          );
        })()
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

      {/* Detail drawer — opened by clicking any row. Surfaces parent / siblings
        * / children / requester all at once. `onNavigate` lets the user drill
        * up to the parent without closing the drawer. */}
      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchAll}
        onNavigate={(id) => setSelectedDetailTaskId(id)}
      />
    </div>
  );
}
