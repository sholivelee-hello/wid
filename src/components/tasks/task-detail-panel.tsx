'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IssuePicker } from '@/components/issues/issue-picker';
import { TaskChipButton } from '@/components/tasks/task-chip-button';
import { DeadlinePopover } from '@/components/tasks/deadline-popover';
import { AddSubTaskRow } from '@/components/tasks/add-sub-task-row';
import { SourceIcon, sourceOpenUrl } from '@/components/tasks/source-icon';
import { Issue, Task, TASK_STATUSES, isTaskDone, isTaskStatus } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  toggleTodayTask, getTodayTaskIds, removeTodayTaskWithDescendants,
  promptNextInTodayIfNeeded,
} from '@/lib/today-tasks';
import { toast } from 'sonner';
import {
  Check, Loader2, CheckCircle2, Circle, CornerLeftUp, ExternalLink,
  ChevronDown, ChevronRight, PauseCircle, Sun, Trash2, User, X, Plus,
} from 'lucide-react';

// `<input type="datetime-local">` round-trip — 기존 구현 그대로 유지.
function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function localDateTimeToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 마감 칩의 D-n 꼬리표. 오늘=D-DAY, 지남=D+n. */
function dDayLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** 위계 뱃지 — ISSUE(보라) / 하위 TASK·부모 TASK(회색). */
function HierarchyBadge({ tone, children }: { tone: 'issue' | 'sub'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center flex-shrink-0 text-[10px] font-bold tracking-[0.07em] px-1.5 h-[17px] rounded',
        tone === 'issue' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
  /** 모달 안에서 부모/하위 task 상세로 전환 (taskId 교체). */
  onNavigate?: (taskId: string) => void;
  /** 호출 페이지가 이미 들고 있는 task 목록 — 전달되면 첫 페인트가 네트워크
   *  없이 즉시 일어난다 (성능 개편의 핵심). 백그라운드 fetch가 진실원본. */
  tasks?: Task[];
  /** 호출 페이지가 이미 들고 있는 ISSUE 목록 — ISSUE 줄 즉시 표시용. */
  issues?: Issue[];
}

export function TaskDetailPanel({
  taskId, onClose, onTaskUpdated, onNavigate, tasks: tasksProp, issues: issuesProp,
}: TaskDetailPanelProps) {
  // ── 데이터: prop 시드로 즉시 그리고, 백그라운드 fetch로 재검증 ──
  const seed = useMemo(
    () => (taskId && tasksProp ? tasksProp.find(t => t.id === taskId) ?? null : null),
    [taskId, tasksProp],
  );
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null);
  const [fetchedPool, setFetchedPool] = useState<Task[] | null>(null);
  const [fetchedIssues, setFetchedIssues] = useState<Issue[] | null>(null);
  const task = fetchedTask ?? seed;
  const pool = fetchedPool ?? tasksProp ?? null;
  const issues = fetchedIssues ?? issuesProp ?? [];

  // ── 편집 필드 (per-field 자동 저장) ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('등록');
  const [requester, setRequester] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [requesterOpen, setRequesterOpen] = useState(false);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [isTodayTask, setIsTodayTask] = useState(false);

  // 저장 인디케이터 — TaskInlineEditor와 동일 라이프사이클.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedAtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 같은 task로 이미 필드를 채웠는지 추적 — save()의 setFetchedTask나 백그라운드
  // 재검증이 같은 id로 다시 도착해도 입력 중인 필드를 서버 값으로 덮지 않게 한다.
  const syncedIdRef = useRef<string | null>(null);

  // task 전환 시 1회만 필드 동기화. 같은 task 재도착(저장/재검증)은 무시.
  useEffect(() => {
    if (!task) return;
    if (syncedIdRef.current === task.id) return;
    syncedIdRef.current = task.id;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setRequester(task.requester ?? '');
    setDelegateTo(task.delegate_to ?? '');
    setDeadline(task.deadline?.slice(0, 10) ?? null);
    setCompletedAt(isoToLocalDateTime(task.completed_at));
    setFollowUpNote(task.follow_up_note ?? '');
    setShowExtras(!!(task.delegate_to || task.follow_up_note));
  }, [task]);

  // 백그라운드 재검증 — 시드가 있으면 화면은 이미 그려져 있고, 이 fetch는
  // 조용히 최신화만 한다. 시드가 없을 때(딥링크성 진입)만 스켈레톤.
  useEffect(() => {
    if (!taskId) { syncedIdRef.current = null; return; }
    let cancelled = false;
    setFetchedTask(null);
    setAddingSub(false);
    apiFetch<Task>(`/api/tasks/${taskId}`, { suppressToast: true })
      .then(t => { if (!cancelled) setFetchedTask(t); })
      .catch(() => { if (!cancelled && !seed) onClose(); });
    apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true })
      .then(ts => { if (!cancelled) setFetchedPool(ts); })
      .catch(() => {});
    apiFetch<Issue[]>('/api/issues', { suppressToast: true })
      .then(is => { if (!cancelled) setFetchedIssues(is); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    const sync = () => setIsTodayTask(taskId ? getTodayTaskIds().has(taskId) : false);
    sync();
    window.addEventListener('today-tasks-changed', sync);
    return () => window.removeEventListener('today-tasks-changed', sync);
  }, [taskId]);

  useEffect(() => {
    if (savedAt === null) return;
    if (savedAtTimerRef.current) clearTimeout(savedAtTimerRef.current);
    savedAtTimerRef.current = setTimeout(() => setSavedAt(null), 1500);
    return () => { if (savedAtTimerRef.current) clearTimeout(savedAtTimerRef.current); };
  }, [savedAt]);

  // ── 관계 계산 (pool 기반 — prop이든 fetch든 같은 코드) ──
  const parentTask = useMemo(
    () => (task?.parent_task_id && pool ? pool.find(t => t.id === task.parent_task_id) ?? null : null),
    [task?.parent_task_id, pool],
  );
  const siblings = useMemo(
    () => (task?.parent_task_id && pool
      ? pool.filter(t => t.parent_task_id === task.parent_task_id && t.id !== task.id)
          .sort((a, b) => a.position - b.position)
      : []),
    [task?.parent_task_id, task?.id, pool],
  );
  const children = useMemo(
    () => (task && !task.parent_task_id && pool
      ? pool.filter(t => t.parent_task_id === task.id).sort((a, b) => a.position - b.position)
      : []),
    [task, pool],
  );
  // "N개 중 M개 완료" — issueTaskProgress와 같은 규약: 취소는 분모에서 제외.
  const subDenominator = children.filter(c => c.status !== '취소').length;
  const subDone = children.filter(c => c.status === '완료').length;

  const currentIssue = task?.issue_id ? issues.find(i => i.id === task.issue_id) ?? null : null;
  const openUrl = task ? sourceOpenUrl(task) : null;

  // ── 자동 저장 (TaskInlineEditor 패턴) ──
  const save = async (patch: Record<string, unknown>) => {
    if (!taskId || !task) return;
    try {
      setSaving(true);
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setFetchedTask(updated);
      window.dispatchEvent(new CustomEvent('task-updated'));
      setSavedAt(Date.now());
      onTaskUpdated?.();
      if (isTaskStatus(patch.status) && isTaskDone(patch.status) && !isTaskDone(task.status)) {
        promptNextInTodayIfNeeded({ ...task, status: patch.status });
      }
    } finally {
      setSaving(false);
    }
  };

  const attachToIssue = async (issueId: string) => {
    await save({ issue_id: issueId, parent_task_id: null });
  };
  const createAndAttach = async (name: string) => {
    const issue = await apiFetch<Issue>('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setFetchedIssues(prev => [...(prev ?? issues), issue]);
    await attachToIssue(issue.id);
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      onClose();
      window.dispatchEvent(new CustomEvent('task-updated'));
      onTaskUpdated?.();
    } catch {}
  };

  const handlePend = async () => {
    if (!taskId) return;
    const pendedId = taskId;
    // 보류 = 오늘에서도 빼냄 (기존 계약 유지). 자손 = 직계 children.
    removeTodayTaskWithDescendants(pendedId, children);
    try {
      await apiFetch(`/api/tasks/${pendedId}/pend`, { method: 'POST' });
    } catch {
      return; // 실패 토스트는 apiFetch가 띄움 — 모달은 열린 채 유지.
    }
    window.dispatchEvent(new CustomEvent('task-updated'));
    onTaskUpdated?.();
    onClose();
    toast('보류함으로 이동했어요', {
      action: {
        label: '되돌리기',
        onClick: async () => {
          try {
            await apiFetch(`/api/tasks/${pendedId}/unpend`, { method: 'POST' });
          } finally {
            window.dispatchEvent(new CustomEvent('task-updated'));
            onTaskUpdated?.();
          }
        },
      },
    });
  };

  // 모달 안에서 하위 task를 만든 직후 children에 바로 보이게 pool만 재요청.
  const refreshPool = () => {
    apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true })
      .then(ts => setFetchedPool(ts))
      .catch(() => {});
  };

  // 하위/부모/형제 줄 공통 렌더러.
  const relationRow = (t: Task) => (
    <button
      key={t.id}
      type="button"
      onClick={() => onNavigate?.(t.id)}
      disabled={!onNavigate}
      className={cn(
        'group/rel w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
        onNavigate && 'hover:bg-primary/5 active:bg-primary/10',
      )}
    >
      {isTaskDone(t.status)
        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        : <Circle className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />}
      <span className={cn(
        'flex-1 truncate text-[13px]',
        isTaskDone(t.status) && 'line-through text-muted-foreground',
      )}>
        {t.title}
      </span>
      {onNavigate && (
        <span className="flex-shrink-0 text-[11px] text-muted-foreground/0 group-hover/rel:text-primary transition-colors">
          상세 보기 ›
        </span>
      )}
    </button>
  );

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="!max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 gap-0">
          {/* 접근성용 제목 — 시각적 헤더는 본문의 로고+제목이 담당. */}
          <DialogHeader className="sr-only">
            <DialogTitle>{task ? task.title : 'TASK 상세'}</DialogTitle>
          </DialogHeader>

          {!task ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* 저장 인디케이터 — 우상단 X 옆에 떠 있게 절대배치 */}
              <div className="absolute top-4 right-12 h-6 flex items-center">
                {savedAt !== null && (
                  <span className="text-[11px] text-primary inline-flex items-center gap-1 animate-in fade-in">
                    <Check className="h-3 w-3" /> 저장됨
                  </span>
                )}
                {saving && savedAt === null && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 animate-in fade-in">
                    <Loader2 className="h-3 w-3 animate-spin" /> 저장 중…
                  </span>
                )}
              </div>

              {/* ── 헤더: 브랜드 로고(출처) + 제목. 출처 텍스트는 쓰지 않는다 ── */}
              <div>
                {/* pr-14 — 우상단 닫기 X(top-2 right-2)·저장 인디케이터(right-12)와
                  * 제목 입력칸이 겹치지 않게 첫 줄만 오른쪽 여백 확보. */}
                <div className="flex items-start gap-2.5 pr-14">
                  <SourceIcon source={task.source} className="mt-[7px] text-[20px]" />
                  <Textarea
                    value={title}
                    rows={1}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                    }}
                    onBlur={() => {
                      if (title.trim() && title !== task.title) {
                        // 노션発 task는 이름을 고치면 name_locked로 잠근다.
                        const patch: Record<string, unknown> = { title: title.trim() };
                        if (task.source === 'notion') patch.name_locked = true;
                        save(patch);
                      }
                    }}
                    className="text-[19px] md:text-[19px] font-extrabold tracking-[-0.035em] leading-tight resize-none min-h-0 bg-transparent dark:bg-transparent border border-transparent hover:border-border focus:border-border px-2 py-1 -ml-2 rounded transition-colors shadow-none focus-visible:ring-1"
                    aria-label="제목"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1 ml-[30px] text-[12px] text-muted-foreground">
                  <span>{formatDate(task.created_at, 'M월 d일')} 등록</span>
                  {openUrl && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        원본 열기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* ── 칩 줄: 상태 / 마감(D-n) / 요청자 / 오늘 — 전부 그 자리 수정 ── */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                  <PopoverTrigger render={<TaskChipButton active>{status}</TaskChipButton>} />
                  <PopoverContent className="w-36 p-1" align="start">
                    <div className="flex flex-col">
                      {TASK_STATUSES.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setStatusOpen(false);
                            if (s === status) return;
                            setStatus(s);
                            save({ status: s });
                          }}
                          className={cn(
                            'text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors',
                            s === status && 'font-semibold',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <DeadlinePopover
                  value={deadline}
                  onChange={(v) => { setDeadline(v); save({ deadline: v }); }}
                />
                {deadline && dDayLabel(deadline) && (
                  <span className={cn(
                    'text-[11px] font-semibold tabular-nums -ml-0.5 mr-0.5',
                    dDayLabel(deadline) === 'D-DAY' || dDayLabel(deadline)!.startsWith('D+')
                      ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {dDayLabel(deadline)}
                  </span>
                )}

                <Popover open={requesterOpen} onOpenChange={setRequesterOpen}>
                  <PopoverTrigger
                    render={
                      <TaskChipButton active={!!requester} icon={<User className="h-3 w-3" />} caret={!requester}>
                        {requester || '요청자'}
                      </TaskChipButton>
                    }
                  />
                  <PopoverContent className="w-52 p-2" align="start">
                    <Input
                      value={requester}
                      autoFocus
                      placeholder="요청자 이름"
                      onChange={(e) => setRequester(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); setRequesterOpen(false); }
                      }}
                      onBlur={() => {
                        if ((requester || null) !== (task.requester || null)) {
                          save({ requester: requester || null });
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <TaskChipButton
                  active={isTodayTask}
                  icon={<Sun className={cn('h-3 w-3', isTodayTask && 'fill-primary text-primary')} />}
                  caret={false}
                  onClick={() => { if (taskId) toggleTodayTask(taskId); }}
                >
                  {isTodayTask ? '오늘에 있음' : '오늘로 보내기'}
                </TaskChipButton>
              </div>

              {/* ── 관계 (정보 1순위) ── */}

              {/* top-level: 소속 ISSUE 줄 */}
              {!task.parent_task_id && (
                currentIssue ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                    <HierarchyBadge tone="issue">ISSUE</HierarchyBadge>
                    <Link
                      href={`/issues/${currentIssue.id}`}
                      onClick={onClose}
                      className="flex-1 min-w-0 group/issue"
                    >
                      <span className="block text-[13.5px] font-semibold truncate group-hover/issue:text-primary transition-colors">
                        {currentIssue.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        이 task가 속한 묶음 · 이슈로 가기 ›
                      </span>
                    </Link>
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs flex-shrink-0"
                      onClick={() => setIssuePickerOpen(true)}>
                      변경
                    </Button>
                    <Button type="button" size="sm" variant="ghost"
                      className="h-6 px-2 text-xs flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => save({ issue_id: null })}>
                      <X className="h-3 w-3 mr-0.5" /> 분리
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 px-3.5 py-3">
                    <HierarchyBadge tone="issue">ISSUE</HierarchyBadge>
                    <span className="flex-1 text-[12px] text-muted-foreground">아직 어떤 묶음에도 속하지 않았어요</span>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => setIssuePickerOpen(true)}>
                      ISSUE 연결
                    </Button>
                  </div>
                )
              )}

              {/* sub-TASK: 부모 카드 + 형제 목록 */}
              {task.parent_task_id && (
                <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <HierarchyBadge tone="sub">부모 TASK</HierarchyBadge>
                    <CornerLeftUp className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </div>
                  {parentTask ? (
                    <>
                      {relationRow(parentTask)}
                      {siblings.length > 0 && (
                        <div className="pt-1 border-t border-border/40">
                          <span className="block px-2 pb-1 text-[11px] text-muted-foreground">
                            같은 부모의 다른 하위 task ({siblings.length})
                          </span>
                          {siblings.map(relationRow)}
                        </div>
                      )}
                    </>
                  ) : (
                    <Skeleton className="h-7 w-full" />
                  )}
                </div>
              )}

              {/* top-level: 하위 TASK 구역 */}
              {!task.parent_task_id && (
                <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <HierarchyBadge tone="sub">하위 TASK</HierarchyBadge>
                    {children.length > 0 ? (
                      <span className="text-[12px] text-muted-foreground font-medium tabular-nums">
                        {subDenominator}개 중 <b className="text-primary font-semibold">{subDone}개 완료</b>
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">아직 없음</span>
                    )}
                  </div>
                  {children.length > 0 && subDenominator > 0 && (
                    <div className="h-1 rounded-full bg-muted overflow-hidden mb-2">
                      <div
                        className="h-full bg-primary rounded-full transition-[width]"
                        style={{ width: `${Math.round((subDone / subDenominator) * 100)}%` }}
                      />
                    </div>
                  )}
                  {children.map(relationRow)}
                  {addingSub ? (
                    <div className="mt-1 pt-2 border-t border-border/40">
                      <AddSubTaskRow
                        parentId={task.id}
                        startOpen
                        onClose={() => { setAddingSub(false); refreshPool(); }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSub(true)}
                      className="mt-0.5 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> 하위 task 추가
                    </button>
                  )}
                </div>
              )}

              {/* ── 설명: 그 자리 편집 ── */}
              <div>
                <Label className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground">설명</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if ((description || null) !== (task.description || null)) {
                      save({ description: description || null });
                    }
                  }}
                  rows={2}
                  placeholder="task 설명…"
                  className="mt-1 bg-transparent dark:bg-transparent border border-transparent hover:border-border focus:border-border shadow-none focus-visible:ring-1 px-2 -ml-2 transition-colors"
                />
              </div>

              {/* ── 추가 정보 (기본 접힘) ── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowExtras(!showExtras)}
                  aria-expanded={showExtras}
                  className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showExtras
                    ? <ChevronDown className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />}
                  추가 정보
                  {!showExtras && (
                    <span className="text-muted-foreground/60">(위임 대상 · 후속 메모{status === '완료' ? ' · 완료일시' : ''})</span>
                  )}
                </button>
                {showExtras && (
                  <div className="mt-3 space-y-3 animate-in fade-in-0 duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">위임 대상</Label>
                        <Input
                          value={delegateTo}
                          onChange={(e) => setDelegateTo(e.target.value)}
                          onBlur={() => {
                            if ((delegateTo || null) !== (task.delegate_to || null)) {
                              save({ delegate_to: delegateTo || null });
                            }
                          }}
                          placeholder="담당자 없음"
                        />
                      </div>
                      {status === '완료' && (
                        <div>
                          <Label className="text-xs text-muted-foreground">완료일시</Label>
                          <Input
                            type="datetime-local"
                            value={completedAt}
                            onChange={(e) => setCompletedAt(e.target.value)}
                            onBlur={() => {
                              if (localDateTimeToIso(completedAt) !== task.completed_at) {
                                save({ completed_at: localDateTimeToIso(completedAt) });
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">후속 작업 메모</Label>
                      <Textarea
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        onBlur={() => {
                          if ((followUpNote || null) !== (task.follow_up_note || null)) {
                            save({ follow_up_note: followUpNote || null });
                          }
                        }}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── 푸터: 가벼운 액션만. 저장 버튼 없음 (자동 저장) ── */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button" variant="ghost" size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handlePend}
                >
                  <PauseCircle className="h-4 w-4 mr-1" /> 보류
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> 휴지통
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={task?.parent_task_id ? 'sub-TASK 삭제' : 'TASK 삭제'}
        description={
          task?.parent_task_id
            ? '이 sub-TASK를 휴지통으로 이동합니다.'
            : '이 TASK를 휴지통으로 이동합니다.'
        }
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />

      <IssuePicker
        open={issuePickerOpen}
        onClose={() => setIssuePickerOpen(false)}
        currentIssueId={task?.issue_id ?? null}
        onPick={attachToIssue}
        onCreate={createAndAttach}
      />
    </>
  );
}
