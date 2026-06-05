# TASK 상세 모달 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TaskDetailPanel`을 "여는 즉시 그려지는, edit-in-place 자동 저장, 위계가 뱃지로 읽히는" 모달로 재작성한다.

**Architecture:** 호출 페이지가 이미 들고 있는 `tasks`/`issues` 배열을 prop으로 받아 **첫 페인트를 네트워크 없이** 수행하고, 단건 task + 전체 풀은 백그라운드에서 재검증해 조용히 갱신한다. 편집은 `TaskInlineEditor`와 동일한 per-field PATCH 자동 저장(저장 버튼 폐지). 스펙: `docs/superpowers/specs/2026-06-05-task-detail-modal-redesign-design.md`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind v4, shadcn/ui(Dialog·Popover), 기존 부품 재사용(`SourceIcon`, `TaskChipButton`, `DeadlinePopover`, `IssuePicker`, `AddSubTaskRow`, `ConfirmDialog`).

**검증 방식:** 이 레포에는 테스트 프레임워크가 없다(`package.json`에 test 스크립트 없음 — 프로젝트 관례). 각 task의 검증은 `npm run build` exit 0 + `npm run lint` 신규 문제 0 + 수동 체크리스트로 한다. TDD 단계는 적용하지 않는다.

**유지해야 할 기존 계약 (절대 깨지 말 것):**
- 상태 3-값 모델 `등록/완료/취소` (`TASK_STATUSES`), 종결 판정 `isTaskDone` (`docs/architecture/status.md`)
- sub-TASK는 부모를 통해 ISSUE에 연결 — sub-TASK에 ISSUE 연결 UI 노출 금지 (`docs/architecture/hierarchy.md`)
- 노션発 task 제목 수정 시 `name_locked: true` 패치 동봉
- 보류 시 `removeTodayTaskWithDescendants` 호출 + 되돌리기 토스트
- 저장 성공 시 `window.dispatchEvent(new CustomEvent('task-updated'))` (열린 페이지 갱신)
- 완료 전환 시 `promptNextInTodayIfNeeded` (today prompt-next 계약, `docs/architecture/today.md`)

---

### Task 1: `task-detail-panel.tsx` 재작성

**Files:**
- Rewrite: `src/components/tasks/task-detail-panel.tsx` (파일명·컴포넌트명·기존 props 유지, `tasks?`/`issues?` 추가)

- [ ] **Step 1: 컴포넌트 전체를 아래 코드로 교체**

참고: 작성 전에 `src/components/tasks/add-sub-task-row.tsx`와 `src/components/tasks/deadline-popover.tsx`의 props를 열어 아래 사용부와 일치하는지 확인하고, 다르면 사용부를 그쪽에 맞춘다 (`AddSubTaskRow`는 task-card.tsx:499-503에서 `parentId`/`startOpen`/`onClose`로 사용 중, `DeadlinePopover`는 task-inline-editor.tsx:205-211에서 `value`/`onChange`로 사용 중).

```tsx
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

  // taskId가 바뀌거나(모달 전환 포함) 재검증 결과가 도착하면 필드 동기화.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setRequester(task.requester ?? '');
    setDelegateTo(task.delegate_to ?? '');
    setDeadline(task.deadline?.slice(0, 10) ?? null);
    setCompletedAt(isoToLocalDateTime(task.completed_at));
    setFollowUpNote(task.follow_up_note ?? '');
    setShowExtras(!!(task.delegate_to || task.follow_up_note));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, fetchedTask]);

  // 백그라운드 재검증 — 시드가 있으면 화면은 이미 그려져 있고, 이 fetch는
  // 조용히 최신화만 한다. 시드가 없을 때(딥링크성 진입)만 스켈레톤.
  useEffect(() => {
    if (!taskId) return;
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
                <div className="flex items-start gap-2.5">
                  <SourceIcon source={task.source} className="mt-[7px] [&_svg]:h-[20px] [&_svg]:w-[20px]" />
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
                        onClose={() => setAddingSub(false)}
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
```

구현 시 주의:
- `SourceIcon`은 내부 svg가 14px 고정이므로 `[&_svg]:h-[20px] [&_svg]:w-[20px]` 클래스 오버라이드가 실제로 적용되는지 확인. 안 되면 `SourceIcon`에 기존 `className` prop을 그대로 쓰되 14px로 타협하지 말고, `source-icon.tsx`의 svg 클래스를 `h-[14px] w-[14px]` → `h-[1em] w-[1em]` + 래퍼 `text-[14px]` 기본값으로 바꿔 크기를 호출부가 정할 수 있게 한다 (manual 점도 동일 비율 확대).
- `PopoverTrigger render={...}` 패턴은 base-ui 기반 shadcn v4 문법 — `task-inline-editor.tsx:172-179`와 동일하게.
- 모달 안 `AddSubTaskRow`는 생성 후 `task-created` 이벤트로 페이지가 갱신되고, 모달 pool은 `task-updated`/재열기로 따라온다. 생성 직후 children에 바로 보이게 하려면 `onClose` 시 `apiFetch<Task[]>('/api/tasks?deleted=false')`로 pool만 재요청 (`setFetchedPool`).

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: exit 0 (타입 에러 0). 실패 시 위 주의사항(컴포넌트 props 불일치)부터 의심.

- [ ] **Step 3: 커밋**

```bash
git add src/components/tasks/task-detail-panel.tsx src/components/tasks/source-icon.tsx
git commit -m "feat: TASK 상세 모달 전면 개편 — 즉시 렌더 + edit-in-place + 위계 뱃지 (스펙 2026-06-05)"
```

---

### Task 2: 호출부 4곳에서 `tasks`/`issues` 전달 (즉시 렌더 와이어링)

**Files:**
- Modify: `src/app/today/page.tsx:666-671`
- Modify: `src/app/inbox/page.tsx:1034-1039`
- Modify: `src/app/issues/[id]/page.tsx:419-424`
- Modify: `src/app/history/page.tsx:477-482`

- [ ] **Step 1: today/page.tsx — `tasks`·`issues` state를 그대로 전달**

```tsx
      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchAll}
        onNavigate={(id) => setSelectedDetailTaskId(id)}
        tasks={tasks}
        issues={issues}
      />
```

- [ ] **Step 2: inbox/page.tsx — 동일 패턴**

```tsx
      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchTasks}
        onNavigate={(id) => setSelectedDetailTaskId(id)}
        tasks={tasks}
        issues={issues}
      />
```

- [ ] **Step 3: issues/[id]/page.tsx — task 목록만 전달 (이 페이지의 `tasks`는 해당 이슈 소속 전체)**

이 파일 상단에서 이슈 단건을 어떤 state로 들고 있는지 확인해 (`useState<Issue...`) 있으면 `issues={[그 이슈]}` 형태로 전달, 모호하면 `issues`는 생략 (모달이 백그라운드 fetch로 채움).

```tsx
      <TaskDetailPanel
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={fetchAll}
        onNavigate={(tid) => setSelectedDetailTaskId(tid)}
        tasks={tasks}
      />
```

- [ ] **Step 4: history/page.tsx — 월 범위 `tasks` 전달**

`globalTasks`는 검색 중에만 채워지는 lazy 목록이므로 쓰지 않는다. 월 범위 `tasks`로도 클릭된 task의 시드는 항상 잡히고(목록에서 클릭했으므로), 관계는 모달의 백그라운드 pool fetch가 채운다.

```tsx
      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchAll}
        onNavigate={(id) => setSelectedTaskId(id)}
        tasks={tasks}
        issues={issues}
      />
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: 커밋**

```bash
git add src/app/today/page.tsx src/app/inbox/page.tsx "src/app/issues/[id]/page.tsx" src/app/history/page.tsx
git commit -m "feat: 상세 모달에 페이지 보유 tasks/issues 전달 — 네트워크 대기 없는 첫 페인트"
```

---

### Task 3: 아키텍처 문서 갱신

**Files:**
- Modify: `docs/architecture/inline-editing.md` (상세 모달 계약 섹션 추가)

- [ ] **Step 1: inline-editing.md 끝에 아래 섹션 추가**

```markdown
## TaskDetailPanel (상세 모달) 계약 — 2026-06-05 개편

- **즉시 렌더**: `tasks` prop에서 시드를 찾아 네트워크 없이 첫 페인트. 백그라운드에서
  단건 task + 전체 pool(`/api/tasks?deleted=false`) + issues를 재검증해 조용히 갱신.
  스켈레톤은 시드가 없는 진입(딥링크성)에서만.
- **edit-in-place 자동 저장**: 저장 버튼 없음. 모든 필드는 blur/선택 시 per-field PATCH —
  TaskInlineEditor와 동일 라이프사이클(저장 중/저장됨 인디케이터, `task-updated` dispatch,
  노션発 제목 수정 시 `name_locked`, 완료 전환 시 promptNextInTodayIfNeeded).
- **위계 뱃지**: 보라 `ISSUE` 뱃지 줄(top-level만, 클릭 시 /issues/[id] 이동 + 변경/분리),
  회색 `하위 TASK` 구역("N개 중 M개 완료" — 분모는 취소 제외, issueTaskProgress 규약과 동일),
  sub-TASK는 `부모 TASK` 카드 + 형제 목록. 줄 클릭 = onNavigate로 모달 내용 전환.
- **출처**: 제목 옆 `SourceIcon` 20px (표시 전용 예외 그대로). 출처 텍스트("Slack에서 옴")는
  쓰지 않는다 — 사용자 명시 결정. 메타 줄은 `등록일 · 원본 열기 ↗`(sourceOpenUrl).
```

- [ ] **Step 2: 커밋**

```bash
git add docs/architecture/inline-editing.md
git commit -m "docs: 상세 모달 개편 계약을 inline-editing.md에 기록"
```

---

### Task 4: 검증 (배포 전 필수)

- [ ] **Step 1: 린트**

Run: `npm run lint`
Expected: 신규 경고/에러 0 (기존 베이스라인과 비교)

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: 수동 체크리스트 (dev 서버)**

Run: `npm run dev` 후 브라우저에서:

1. `/inbox`에서 카드 클릭 → 모달 본문이 **스켈레톤 없이 즉시** 보인다 (네트워크 throttle Slow 3G로도 본문 즉시, 관계 구역만 잠깐 placeholder).
2. 슬랙/노션/JIRA/직접입력 task 각각 열어 제목 옆 로고 확인, "Slack에서 옴" 류 텍스트 없음, "원본 열기 ↗" 동작 (직접 입력은 링크 자체가 없음).
3. 제목 수정 → blur → "저장됨" 표시, 리스트에 반영. 노션 task 제목 수정 후에도 노션 sync가 이름을 되돌리지 않음(name_locked).
4. 상태 칩 → 완료 선택 → 오늘 묶음에 있던 task면 prompt-next 토스트.
5. 마감 칩 변경(D-n 갱신), 요청자 칩, ☀ 오늘 토글 각각 자동 저장.
6. 하위 task 있는 TASK: "N개 중 M개 완료" + 진행률 바, 취소 상태 하위는 분모 제외. "상세 보기 ›" → 모달 전환, 그 sub-TASK에서 부모 TASK 카드로 복귀.
7. sub-TASK에 ISSUE 연결 UI가 **안 보임** (부모 경유 invariant).
8. "＋ 하위 task 추가" → 생성 → 구역에 반영.
9. ISSUE 줄 클릭 → `/issues/[id]` 이동, 변경/분리 동작. 미연결 TASK는 "ISSUE 연결" 버튼.
10. 보류 → 모달 닫힘 + 토스트 되돌리기. 휴지통 → 확인 다이얼로그 → 삭제.
11. `/today`, `/issues/[id]`, `/history`에서도 1·6 재확인.

- [ ] **Step 4: 미커밋 변경 없으면 종료**

Run: `git status`
Expected: clean (Task 1~3에서 모두 커밋됨). 이 브랜치는 `feat/issue-task-hierarchy` — 배포는 사용자 지시 후 CLAUDE.md 배포 프로세스(커밋→푸시→빌드 검증→배포) 순서로.
