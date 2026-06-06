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
import { AddSubTaskRow } from '@/components/tasks/add-sub-task-row';
import {
  Circle,
  CheckCircle2,
  Check,
  Trash2,
  ExternalLink,
  User,
  CalendarDays,
  FolderOpen,
  Sun,
  PauseCircle,
  ListChecks,
  Plus,
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
  /** 우클릭 "ISSUE에 연결" 서브메뉴에 노출할 활성 ISSUE 목록. `onLinkIssue`와
   *  함께 전달될 때만 서브메뉴를 렌더한다. sub-TASK는 부모를 통해 ISSUE에
   *  연결되므로(hierarchy invariant) 노출하지 않는다. */
  linkableIssues?: { id: string; name: string }[];
  /** ISSUE 연결/해제 핸들러. issueId=null이면 연결 해제. */
  onLinkIssue?: (taskId: string, issueId: string | null) => void;
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
  linkableIssues,
  onLinkIssue,
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
  // 우클릭 "하위 task 추가" → 카드 아래 인라인 입력. 생성은 AddSubTaskRow가
  // 처리하고 task-created 이벤트로 모든 페이지가 새로고침되므로 부모 wiring 불필요.
  const [addingSub, setAddingSub] = useState(false);

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

      {/* 하위 task 추가 — 3-level invariant상 top-level TASK에서만 허용
        * (sub-TASK에 또 하위를 달면 MAX_DEPTH로 400). */}
      {!task.parent_task_id && (
        <ContextMenuItem onClick={() => setAddingSub(true)}>
          <Plus />
          하위 task 추가
        </ContextMenuItem>
      )}

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

      {/* ISSUE에 연결 — top-level TASK만 (sub-TASK는 부모를 통해 연결되는
        * hierarchy invariant). linkableIssues + onLinkIssue 둘 다 있을 때만. */}
      {linkableIssues && onLinkIssue && !isSubtask && !task.parent_task_id && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpen />
            ISSUE에 연결
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-[320px] overflow-y-auto">
            {linkableIssues.length === 0 ? (
              <ContextMenuItem disabled>활성 ISSUE가 없어요</ContextMenuItem>
            ) : (
              linkableIssues.map((iss) => {
                const linked = task.issue_id === iss.id;
                return (
                  <ContextMenuItem
                    key={iss.id}
                    onClick={() => onLinkIssue(task.id, iss.id)}
                  >
                    {linked ? (
                      <Check className="text-primary" />
                    ) : (
                      <FolderOpen className="text-muted-foreground" />
                    )}
                    <span className="whitespace-normal break-words">{iss.name}</span>
                  </ContextMenuItem>
                );
              })
            )}
            {task.issue_id && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onLinkIssue(task.id, null)}>
                  연결 해제
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {onPend && (
        <ContextMenuItem onClick={() => onPend(task.id)}>
          <PauseCircle />
          보류
        </ContextMenuItem>
      )}

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
        {/* 제목이 여러 줄로 늘어날 수 있어 상단 정렬 — 완료 동그라미/제목 첫 줄을 맞춘다. */}
        <div className="flex items-start gap-3">
          {/* Completion toggle */}
          {(() => {
            const blocked = completeBlocked;
            return (
              <button
                type="button"
                disabled={blocked}
                className={cn(
                  // 제목 여러 줄 시 첫 줄에 동그라미가 정렬되도록 미세 하향 보정.
                  'touch-hitarea flex-shrink-0 -m-1.5 mt-[1px] p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
              // ISSUE 이름은 길어도 잘리지 않고 끝까지 보여준다 (사용자 요청) — wrap 허용
              <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                {/* When this row is a sub-TASK shown out of its tree (e.g.
                  * Today flat list), prefix the breadcrumb with a clear
                  * "하위" label so the type is identifiable without indent. */}
                {isSubtask && (
                  <span className="inline-flex items-center text-[10px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary">
                    하위
                  </span>
                )}
                {breadcrumb.issueName && (
                  <span className="inline-flex items-start gap-1 min-w-0 text-muted-foreground/90">
                    <FolderOpen className="h-3 w-3 flex-shrink-0 mt-[2px]" aria-hidden />
                    <span className="whitespace-normal break-words font-medium">{breadcrumb.issueName}</span>
                  </span>
                )}
                {breadcrumb.issueName && breadcrumb.parentTaskTitle && (
                  <span className="text-muted-foreground/50">›</span>
                )}
                {breadcrumb.parentTaskTitle && (
                  <span className="whitespace-normal break-words min-w-0 text-muted-foreground/85">{breadcrumb.parentTaskTitle}</span>
                )}
              </div>
            )}
            {/* 제목이 여러 줄로 늘어나도 아이콘·뱃지는 첫 줄에 맞춘다 (items-start + 첫 줄 보정). */}
            <div className="flex items-start gap-2">
              {/* Sub-task connector glyph — sits flush before the title so the
                * row reads as "└ child of the row above" without taking width
                * with a label badge. Only shown for sub-tasks. */}
              {isSubtask && (
                <span
                  aria-hidden
                  className="text-muted-foreground/50 dark:text-muted-foreground/40 select-none flex-shrink-0 -ml-0.5 mt-[2px] leading-none"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  ↳
                </span>
              )}
              {/* 출처 브랜드 아이콘 — 표시 전용. 제목 바로 앞. 첫 줄 정렬 보정. */}
              <SourceIcon source={task.source} className="flex-shrink-0 mt-[2px]" />
              {reasonBadge === 'deadline' && !isDone && (
                <span
                  className="inline-flex items-center flex-shrink-0 mt-[1px] text-[10px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20"
                  title="마감일이 오늘이거나 지나서 자동으로 오늘에 포함됐어요"
                >
                  마감
                </span>
              )}
              <span
                className={cn(
                  // 긴 제목은 잘리지 않고 끝까지 줄바꿈으로 보여준다 (사용자 요청).
                  // 첫 줄 정렬 기준이 되도록 줄간격은 snug 유지.
                  'leading-snug whitespace-normal break-words tracking-[-0.012em]',
                  // 2026-06-05 사용자 피드백: light/60·subtask/80이 너무 흐릿 —
                  // 위계는 폰트 크기·굵기가 이미 담당하므로 투명도 바닥을 올린다.
                  isSubtask
                    ? 'text-[14px] font-normal text-foreground/90'
                    : weight === 'heavy'
                      ? 'text-[15px] font-bold text-foreground'
                      : weight === 'light'
                        ? 'text-[14px] font-normal text-foreground/80'
                        : hasChildren
                          ? 'text-[15px] font-semibold text-foreground'
                          : 'text-[15px] font-medium text-foreground',
                  isDone && 'line-through text-muted-foreground',
                )}
                title={task.title}
              >
                {task.title}
              </span>
            </div>

            {(issueChip || task.deadline || task.requester || (subCount > 0 && onToggleSubs)) && (
              <div className="flex items-center gap-x-2.5 gap-y-1 text-[13px] flex-wrap text-muted-foreground">
                {issueChip && (
                  <Link
                    href={`/issues/${issueChip.id}`}
                    onClick={(e) => e.stopPropagation()}
                    // ISSUE 이름은 길어도 칩 안에서 줄바꿈으로 전부 보여준다 (사용자 요청).
                    className="inline-flex items-start gap-1 min-w-0 px-1.5 min-h-5 py-0.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                    title={issueChip.name}
                  >
                    <FolderOpen className="h-3 w-3 flex-shrink-0 mt-[2px]" aria-hidden />
                    <span className="whitespace-normal break-words font-medium leading-tight">{issueChip.name}</span>
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
                {subCount > 0 && onToggleSubs && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSubs(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-expanded={subsExpanded}
                    className="touch-hitarea inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
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
        {addingSub && !editing && (
          <div
            className="mt-2 pt-2 border-t border-border/40"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <AddSubTaskRow
              parentId={task.id}
              startOpen
              onClose={() => setAddingSub(false)}
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
