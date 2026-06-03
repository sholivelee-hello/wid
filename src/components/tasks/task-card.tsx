'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { STATUS_ICONS } from '@/lib/constants';
import { TASK_STATUSES, type TaskStatus, isTaskDone } from '@/lib/types';
import { Task } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { toggleTodayTask, getTodayTaskIds } from '@/lib/today-tasks';
import { TaskInlineEditor } from '@/components/tasks/task-inline-editor';
import { getTaskWeight } from '@/lib/task-weight';
import { SourceIcon, sourceOpenUrl } from '@/components/tasks/source-icon';
import {
  Circle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  User,
  CalendarDays,
  FolderOpen,
  Sun,
  PauseCircle,
  ListChecks,
  Pencil,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  /** 보류함으로 이동. 전달되지 않으면 메뉴에 보류 항목이 표시되지 않는다
   *  (Today·휴지통 등 보류 액션이 없는 화면). */
  onPend?: (taskId: string) => void;
  /** Optional hierarchy label rendered as a small badge before the title.
   * Kept for legacy callers; new code should rely on `isSubtask` + indent for
   * the hierarchy cue instead. Defaults to no badge. */
  hierarchyLabel?: 'TASK' | 'sub-TASK';
  /** Sub-task styling: smaller title, slightly muted tone, leading connector
   * glyph. Combined with the parent's indent/rail this makes the parent vs.
   * child distinction unmistakable in dark mode. */
  isSubtask?: boolean;
  /** Hint that this row has children — used to bold the title so the parent
   * reads as "container" rather than "peer". */
  hasChildren?: boolean;
  /** Renders a small "ISSUE › 부모 TASK" breadcrumb above the title — useful in
   *  flat lists like Today, where the tree context is otherwise lost. */
  breadcrumb?: { issueName?: string | null; parentTaskTitle?: string | null };
  /** When true, an inline editor is rendered below the main row. Toggle from
   *  the parent (typically by tracking `editingTaskId`). */
  editing?: boolean;
  /** Called by the inline editor when the user closes it (e.g. clicks 닫기). */
  onCloseEdit?: () => void;
  /** Marks WHY this row appears where it does. 'deadline' = auto-included in
   *  오늘 because its due date is today/past (spec 결정 4). Renders a small
   *  "마감" pill before the title. */
  reasonBadge?: 'deadline';
  /** 카드 2행 메타에 표시할 소속 ISSUE. 평면 리스트(/inbox)에서 사용.
   *  칩 클릭 시 `/issues/[id]`로 이동한다. 없으면 칩 생략. */
  issueChip?: { id: string; name: string } | null;
  /** 직속 sub-TASK 개수. 0보다 크면 2행에 `↳ sub N` 토글을 렌더한다. */
  subCount?: number;
  /** sub 펼침 상태 (부모가 소유). `↳ sub N` 클릭 시 onToggleSubs 호출. */
  subsExpanded?: boolean;
  onToggleSubs?: () => void;
}

export function TaskCard({
  task,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
  onPend,
  isSubtask = false,
  hasChildren = false,
  breadcrumb,
  editing = false,
  onCloseEdit,
  reasonBadge,
  issueChip,
  subCount = 0,
  subsExpanded = false,
  onToggleSubs,
}: TaskCardProps) {
  const openDetail = () => {
    if (onSelect) onSelect(task.id);
    else window.location.href = `/tasks/${task.id}`;
  };
  // page.tsx의 todayStr 고정 패턴과 동일 — 자정 넘김 시 렌더마다 무게가 바뀌지 않게.
  const [weightNow] = useState(() => new Date());
  const isDone = isTaskDone(task.status);
  // 마감일 기반 무게 — 처리된 task는 line-through가 우선이므로 normal 고정.
  const weight = isDone ? 'normal' : getTaskWeight(task.deadline, weightNow);

  const [isTodayTask, setIsTodayTask] = useState(() => getTodayTaskIds().has(task.id));
  const [completePulse, setCompletePulse] = useState(0);

  useEffect(() => {
    const handler = () => setIsTodayTask(getTodayTaskIds().has(task.id));
    window.addEventListener('today-tasks-changed', handler);
    return () => window.removeEventListener('today-tasks-changed', handler);
  }, [task.id]);

  let deadlineSuffix = '';
  if (task.deadline) {
    const d = new Date(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today && !isDone) deadlineSuffix = ' · 기한 초과';
    else if (d.toDateString() === today.toDateString()) deadlineSuffix = ' · 오늘';
  }

  // 완료 토글 가드 — completion 버튼과 동일 규칙: 핸들러가 없고 아직 미완료면
  // (하위 task 미완료) 완료가 막힌다.
  const completeBlocked = !onComplete && !isDone;

  // 우클릭 컨텍스트 메뉴 — 카드가 이미 가진 액션만 그대로 노출(새 로직 없음).
  // 인라인 에디터가 열려 있을 때는 렌더하지 않아 텍스트 입력 중 브라우저 기본
  // 우클릭(맞춤법 등)이 그대로 동작한다.
  const openUrl = sourceOpenUrl(task);
  const contextMenuContent = (
    <ContextMenuContent>
      {openUrl && (
        <>
          <ContextMenuItem onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink />
            원본 열기
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        disabled={completeBlocked}
        onClick={() => {
          if (completeBlocked) return;
          setCompletePulse((p) => p + 1);
          onComplete?.(task.id);
        }}
      >
        {isDone ? (
          <Circle className="text-muted-foreground" />
        ) : (
          <CheckCircle2 className="text-primary" />
        )}
        {isDone ? '완료 취소' : '완료'}
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          toggleTodayTask(task.id);
        }}
      >
        <Sun className={cn(isTodayTask && 'fill-primary text-primary')} />
        {isTodayTask ? '오늘에서 빼기' : '오늘로 보내기'}
      </ContextMenuItem>

      {onStatusChange && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListChecks />
            상태 변경
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {TASK_STATUSES.map((s) => {
              const Icon = STATUS_ICONS[s];
              return (
                <ContextMenuItem
                  key={s}
                  onClick={() => onStatusChange?.(task.id, s)}
                >
                  {Icon && <Icon className="text-muted-foreground" />}
                  {s}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {onPend && (
        <ContextMenuItem onClick={() => onPend(task.id)}>
          <PauseCircle />
          보류
        </ContextMenuItem>
      )}

      <ContextMenuItem onClick={openDetail}>
        <Pencil />
        상세 열기
      </ContextMenuItem>

      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => onDelete(task.id)}>
            <Trash2 />
            휴지통으로 이동
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );

  const card = (
    <div
      tabIndex={0}
      role="button"
      className={cn(
        // Korean-IT list-row idiom — divider on the parent, not card-per-row.
        // card-hover-lift adds a 1px upward translate + soft shadow on hover
        // so each row reads as a tactile object instead of dead text. Active
        // returns to baseline + a sub-1% scale so press is felt.
        'group/card card-hover-lift relative bg-transparent rounded-md cursor-pointer select-none',
        'hover:bg-accent/70 dark:hover:bg-accent/40 active:bg-accent/90 dark:active:bg-accent/55',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDone && 'opacity-55',
        editing && 'bg-accent/60 dark:bg-accent/40',
      )}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      {(editing || (weight === 'heavy' && !isSubtask)) && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}
      <div className={cn(isSubtask ? 'px-3 py-2' : 'px-3 py-3')}>
        <div className="flex items-center gap-3">
          {/* Completion toggle */}
          {(() => {
            const blocked = completeBlocked;
            return (
              <button
                type="button"
                disabled={blocked}
                className={cn(
                  'flex-shrink-0 -m-1.5 p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  blocked
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-muted',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!blocked) setCompletePulse(p => p + 1);
                  onComplete?.(task.id);
                }}
                title={
                  blocked
                    ? '하위 task가 모두 완료되어야 완료할 수 있어요'
                    : isDone ? '완료 취소' : '완료 처리'
                }
                aria-label={
                  blocked
                    ? '완료 불가 (하위 task 미완료)'
                    : isDone ? '완료 취소' : '완료 처리'
                }
              >
                {/* Unified wrapper for both states — keeps the button's
                  * inline-content metrics stable across toggle so the row
                  * doesn't drift up/down 1-2px when status flips. */}
                <span
                  className="relative inline-grid place-items-center h-[18px] w-[18px] align-middle"
                  aria-hidden
                >
                  {isDone ? (
                    <>
                      {completePulse > 0 && (
                        <span
                          key={`ring-${completePulse}`}
                          className="absolute h-[18px] w-[18px] rounded-full bg-primary/30 animate-task-ring pointer-events-none"
                        />
                      )}
                      <CheckCircle2
                        key={`done-${completePulse}`}
                        className="h-[18px] w-[18px] text-primary animate-task-complete"
                      />
                    </>
                  ) : (
                    <Circle
                      className={cn(
                        'h-[18px] w-[18px] transition-colors',
                        blocked
                          ? 'text-muted-foreground/40'
                          : 'text-muted-foreground/50 hover:text-primary',
                      )}
                    />
                  )}
                </span>
              </button>
            );
          })()}

          {/* Title + metadata */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {breadcrumb && (breadcrumb.issueName || breadcrumb.parentTaskTitle) && (
              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                {/* When this row is a sub-TASK shown out of its tree (e.g.
                  * Today flat list), prefix the breadcrumb with a clear
                  * "하위" label so the type is identifiable without indent. */}
                {isSubtask && (
                  <span className="inline-flex items-center text-[10px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary">
                    하위
                  </span>
                )}
                {breadcrumb.issueName && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/90">
                    <FolderOpen className="h-3 w-3" aria-hidden />
                    <span className="truncate font-medium">{breadcrumb.issueName}</span>
                  </span>
                )}
                {breadcrumb.issueName && breadcrumb.parentTaskTitle && (
                  <span className="text-muted-foreground/50">›</span>
                )}
                {breadcrumb.parentTaskTitle && (
                  <span className="truncate text-muted-foreground/85">{breadcrumb.parentTaskTitle}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Sub-task connector glyph — sits flush before the title so the
                * row reads as "└ child of the row above" without taking width
                * with a label badge. Only shown for sub-tasks. */}
              {isSubtask && (
                <span
                  aria-hidden
                  className="text-muted-foreground/50 dark:text-muted-foreground/40 select-none flex-shrink-0 -ml-0.5 leading-none"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  ↳
                </span>
              )}
              {/* 출처 브랜드 아이콘 — 표시 전용. 제목 바로 앞. */}
              <SourceIcon source={task.source} className="flex-shrink-0" />
              {reasonBadge === 'deadline' && !isDone && (
                <span
                  className="inline-flex items-center flex-shrink-0 text-[10px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20"
                  title="마감일이 오늘이거나 지나서 자동으로 오늘에 포함됐어요"
                >
                  마감
                </span>
              )}
              <span
                className={cn(
                  'leading-snug truncate tracking-[-0.012em]',
                  isSubtask
                    ? 'text-[13px] font-normal text-foreground/80'
                    : weight === 'heavy'
                      ? 'text-[15px] font-bold text-foreground'
                      : weight === 'light'
                        ? 'text-[13px] font-normal text-foreground/60'
                        : hasChildren
                          ? 'text-[14.5px] font-semibold text-foreground'
                          : 'text-[14px] font-medium text-foreground',
                  isDone && 'line-through text-muted-foreground',
                )}
                title={task.title}
              >
                {task.title}
              </span>
            </div>

            {(issueChip || task.deadline || task.requester || subCount > 0) && (
              <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
                {issueChip && (
                  <Link
                    href={`/issues/${issueChip.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 max-w-[180px] px-1.5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                    title={issueChip.name}
                  >
                    <FolderOpen className="h-3 w-3 flex-shrink-0" aria-hidden />
                    <span className="truncate font-medium">{issueChip.name}</span>
                  </Link>
                )}
                {task.deadline && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      weight === 'heavy' && !isDone && 'text-primary font-medium',
                    )}
                  >
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                  </span>
                )}
                {task.requester && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" aria-hidden="true" />
                    {task.requester}
                  </span>
                )}
                {subCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSubs?.(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-expanded={subsExpanded}
                    className="inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                  >
                    <span aria-hidden>↳</span> sub {subCount}
                    <span className="text-muted-foreground/60">{subsExpanded ? '· 접기' : '· 펼치기'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {editing && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <TaskInlineEditor
              task={task}
              onClose={() => onCloseEdit?.()}
            />
          </div>
        )}
      </div>
    </div>
  );

  // 인라인 에디터가 열려 있으면 우클릭 메뉴를 끼우지 않는다 — 텍스트 필드에서
  // 브라우저 기본 우클릭(맞춤법/복사 등)이 자연스럽게 뜨도록.
  if (editing) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger render={card} />
      {contextMenuContent}
    </ContextMenu>
  );
}
