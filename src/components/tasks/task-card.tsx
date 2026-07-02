'use client';

import * as React from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STATUS_ICONS } from '@/lib/constants';
import { TASK_STATUSES, type TaskStatus, isTaskDone } from '@/lib/types';
import { Task } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { toggleTodayMembership, getTodayTaskIds } from '@/lib/today-tasks';
import { TaskInlineEditor } from '@/components/tasks/task-inline-editor';
import { getTaskWeight } from '@/lib/task-weight';
import { SourceIcon, sourceOpenUrl } from '@/components/tasks/source-icon';
import { AddSubTaskRow } from '@/components/tasks/add-sub-task-row';
import { SwipeActionRow } from '@/components/tasks/swipe-action-row';
import { TaskActionSheet, SHEET_KIT } from '@/components/tasks/task-action-sheet';
import { useMediaQuery } from '@/lib/use-media-query';
import { toast } from 'sonner';
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
  MoreHorizontal,
} from 'lucide-react';

/** 우클릭(ContextMenu)과 ⋯ 버튼(DropdownMenu)이 같은 액션 목록을 렌더하기
 *  위한 프리미티브 주입 킷. 항목 정의는 renderActionItems 한 곳에만 둔다 —
 *  모바일엔 우클릭이 없어 ⋯ 입구가 필요 (모바일 spec ③, 2026-06-06). */
interface MenuKit {
  Item: React.ComponentType<{
    disabled?: boolean;
    variant?: 'destructive';
    /** false면 클릭 후에도 메뉴/시트가 닫히지 않는다 — 2단계 삭제의 1단계용.
     *  base-ui Menu.Item의 동명 prop과 동일 의미 (기본 true). */
    closeOnClick?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }>;
  Separator: React.ComponentType;
  Sub: React.ComponentType<{ children: React.ReactNode }>;
  SubTrigger: React.ComponentType<{ children: React.ReactNode }>;
  SubContent: React.ComponentType<{ className?: string; children: React.ReactNode }>;
}

// 실제 컴포넌트들은 MenuKit보다 넓은 props를 받으므로 구조적으로 호환 — cast로 고정.
const CTX_KIT = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
} as unknown as MenuKit;

const DD_KIT = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
} as unknown as MenuKit;

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
  // 인터랙션 분기 = 포인터 능력. 터치 기기에서만 스와이프 활성(데스크톱 비용 0).
  const isCoarse = useMediaQuery('(pointer: coarse)');
  // page.tsx의 todayStr 고정 패턴과 동일 — 자정 넘김 시 렌더마다 무게가 바뀌지 않게.
  const [weightNow] = useState(() => new Date());
  const isDone = isTaskDone(task.status);
  // 마감일 기반 무게 — 처리된 task는 line-through가 우선이므로 normal 고정.
  const weight = isDone ? 'normal' : getTaskWeight(task.deadline, weightNow);

  // 오늘 소속 = explicit(localStorage) ∪ 서버 is_today 플래그(JIRA 자동 포함).
  const [explicitToday, setExplicitToday] = useState(() => getTodayTaskIds().has(task.id));
  const isTodayTask = explicitToday || !!task.is_today;
  const [completePulse, setCompletePulse] = useState(0);
  // 모바일 바텀 액션 시트 열림 상태 — 롱프레스·⋯ 둘 다 같은 시트를 연다.
  const [sheetOpen, setSheetOpen] = useState(false);
  // 롱프레스 감지용 — touchstart 후 500ms 유지 + 이동 10px 미만이면 시트 발동.
  // SwipeActionRow의 가로 스와이프와 충돌하지 않게 카드 div의 터치 이벤트에만 단다.
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = React.useRef<{ x: number; y: number } | null>(null);
  // 롱프레스 발동 직후 손가락을 떼면 따라오는 합성 click을 1회 무시(상세 오발 방지).
  const suppressClickRef = React.useRef(false);
  // 우클릭 "하위 task 추가" → 카드 아래 인라인 입력. 생성은 AddSubTaskRow가
  // 처리하고 task-created 이벤트로 모든 페이지가 새로고침되므로 부모 wiring 불필요.
  const [addingSub, setAddingSub] = useState(false);
  // 2단계 삭제 — 메뉴의 '휴지통으로 이동'을 한 번 누르면 '진짜 삭제'로 무장
  // (메뉴는 열린 채 유지), 한 번 더 누르면 실제 삭제. 확인 모달 없음
  // (사용자 결정 2026-07-02). 메뉴/시트가 닫히면 무장 해제.
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    const handler = () => setExplicitToday(getTodayTaskIds().has(task.id));
    window.addEventListener('today-tasks-changed', handler);
    return () => window.removeEventListener('today-tasks-changed', handler);
  }, [task.id]);

  // unmount 시 롱프레스 타이머 정리(리크 방지).
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  // 롱프레스 핸들러 — coarse(터치) + 비편집 + 미완료가 아닌 일반 상태에서만 단다.
  // SwipeActionRow가 카드 바깥을 감싸므로(가로 스와이프 전담) 여기 카드 div의
  // 터치는 충돌 없이 공존한다. 단, 손가락이 10px 이상 움직이면(스크롤·스와이프
  // 시작) 타이머를 취소해 롱프레스가 오발하지 않게 한다.
  const handleTouchStartLP = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || editing) return;
    const t = e.touches[0];
    clearLongPress();
    longPressStartRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = setTimeout(() => {
      navigator.vibrate?.(10);
      suppressClickRef.current = true;
      setSheetOpen(true);
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
    }, 500);
  };

  const handleTouchMoveLP = (e: React.TouchEvent) => {
    const start = longPressStartRef.current;
    if (!start || !longPressTimerRef.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - start.x) >= 10 || Math.abs(t.clientY - start.y) >= 10) {
      clearLongPress();
    }
  };

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
  const renderActionItems = (M: MenuKit) => (
    <>
      {openUrl && (
        <>
          <M.Item onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink />
            원본 열기
          </M.Item>
          <M.Separator />
        </>
      )}
      <M.Item
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
      </M.Item>
      <M.Item onClick={() => { toggleTodayMembership(task); }}>
        <Sun className={cn(isTodayTask && 'fill-primary text-primary')} />
        {isTodayTask ? '오늘에서 빼기' : '오늘로 보내기'}
      </M.Item>

      {/* 하위 task 추가 — 3-level invariant상 top-level TASK에서만 (기존 동일) */}
      {!task.parent_task_id && (
        <M.Item onClick={() => setAddingSub(true)}>
          <Plus />
          하위 task 추가
        </M.Item>
      )}

      {onStatusChange && (
        <M.Sub>
          <M.SubTrigger>
            <ListChecks />
            상태 변경
          </M.SubTrigger>
          <M.SubContent>
            {TASK_STATUSES.map((s) => {
              const Icon = STATUS_ICONS[s];
              return (
                <M.Item key={s} onClick={() => onStatusChange?.(task.id, s)}>
                  {Icon && <Icon className="text-muted-foreground" />}
                  {s}
                </M.Item>
              );
            })}
          </M.SubContent>
        </M.Sub>
      )}

      {linkableIssues && onLinkIssue && !isSubtask && !task.parent_task_id && (
        <M.Sub>
          <M.SubTrigger>
            <FolderOpen />
            ISSUE에 연결
          </M.SubTrigger>
          <M.SubContent className="max-h-[320px] overflow-y-auto">
            {linkableIssues.length === 0 ? (
              <M.Item disabled>활성 ISSUE가 없어요</M.Item>
            ) : (
              linkableIssues.map((iss) => {
                const linked = task.issue_id === iss.id;
                return (
                  <M.Item key={iss.id} onClick={() => onLinkIssue(task.id, iss.id)}>
                    {linked ? (
                      <Check className="text-primary" />
                    ) : (
                      <FolderOpen className="text-muted-foreground" />
                    )}
                    <span className="whitespace-normal break-words">{iss.name}</span>
                  </M.Item>
                );
              })
            )}
            {task.issue_id && (
              <>
                <M.Separator />
                <M.Item onClick={() => onLinkIssue(task.id, null)}>연결 해제</M.Item>
              </>
            )}
          </M.SubContent>
        </M.Sub>
      )}

      {onPend && (
        <M.Item onClick={() => onPend(task.id)}>
          <PauseCircle />
          보류
        </M.Item>
      )}

      {onDelete && (
        <>
          <M.Separator />
          <M.Item
            variant="destructive"
            closeOnClick={deleteArmed}
            onClick={() => {
              if (deleteArmed) {
                setDeleteArmed(false);
                onDelete(task.id);
              } else {
                setDeleteArmed(true);
              }
            }}
          >
            <Trash2 />
            {deleteArmed ? '진짜 삭제' : '휴지통으로 이동'}
          </M.Item>
        </>
      )}
    </>
  );

  const contextMenuContent = (
    <ContextMenuContent>{renderActionItems(CTX_KIT)}</ContextMenuContent>
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
      onClick={() => {
        // 롱프레스로 시트를 띄운 직후 따라오는 합성 click 1회는 무시(상세 오발 방지).
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        openDetail();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
      // 롱프레스 감지 — coarse(터치)에서만 단다. fine(데스크톱)엔 핸들러 없음(회귀 0).
      onTouchStart={isCoarse ? handleTouchStartLP : undefined}
      onTouchMove={isCoarse ? handleTouchMoveLP : undefined}
      onTouchEnd={isCoarse ? clearLongPress : undefined}
      onTouchCancel={isCoarse ? clearLongPress : undefined}
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
              <div className="text-[11px] max-sm:text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                {/* When this row is a sub-TASK shown out of its tree (e.g.
                  * Today flat list), prefix the breadcrumb with a clear
                  * "하위" label so the type is identifiable without indent. */}
                {isSubtask && (
                  <span className="inline-flex items-center text-[10px] max-sm:text-[11px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary">
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
                  className="inline-flex items-center flex-shrink-0 mt-[1px] text-[10px] max-sm:text-[11px] font-semibold tracking-wide px-1.5 h-[16px] rounded bg-primary/12 text-primary dark:bg-primary/20"
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
              <div className="flex items-center gap-x-2.5 gap-y-1 max-sm:gap-y-1.5 text-[13px] max-sm:text-sm flex-wrap text-muted-foreground">
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

          {/* ⋯ 더보기 — 데스크톱(fine) 전용 hover 입구.
            * 터치(coarse)에서는 롱프레스 → 바텀 시트가 유일한 입구 — ⋯ 버튼은
            * 롱프레스 도입 후 군더더기라 제거 (사용자 결정 2026-06-07).
            * 인라인 에디터 중에는 우클릭 메뉴와 동일하게 숨긴다. */}
          {!editing && !isCoarse && (
            <DropdownMenu onOpenChange={(open) => { if (!open) setDeleteArmed(false); }}>
              <DropdownMenuTrigger
                aria-label="task 액션 메뉴"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={cn(
                  'touch-hitarea flex-shrink-0 -m-1 p-1 mt-[1px] rounded text-muted-foreground/60',
                  'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100',
                  'hover:bg-muted hover:text-foreground transition-opacity',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {renderActionItems(DD_KIT)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

  // ContextMenuTrigger의 render prop은 대상 엘리먼트에 props/ref를 주입하므로
  // 반드시 DOM 노드를 직접 렌더하는 card를 받아야 한다. 따라서 스와이프 래퍼는
  // ContextMenu '바깥'에 둔다 (SwipeActionRow > ContextMenu > card 순서).
  // enabled=false면 SwipeActionRow가 children을 그대로 반환 — 데스크톱 회귀 0.
  const withMenu =
    editing || isCoarse ? (
      // 인라인 에디터 중에는 우클릭 메뉴를 끼우지 않는다 — 텍스트 필드에서
      // 브라우저 기본 우클릭(맞춤법/복사 등)이 자연스럽게 뜨도록.
      // coarse(터치)에서도 base-ui ContextMenu를 끼우지 않는다 — 롱프레스를
      // 가로채지 않게 하고, 대신 카드 div의 자체 롱프레스 + 바텀 시트로 대체.
      card
    ) : (
      <ContextMenu onOpenChange={(open) => { if (!open) setDeleteArmed(false); }}>
        <ContextMenuTrigger render={card} />
        {contextMenuContent}
      </ContextMenu>
    );

  // 터치 기기에서만 스와이프(왼쪽=완료, 오른쪽=보류). isDone·editing이면 비활성.
  return (
    <>
      <SwipeActionRow
        enabled={isCoarse && !isDone && !editing}
        onSwipeComplete={
          onComplete && !completeBlocked
            ? () => {
                setCompletePulse((p) => p + 1);
                onComplete(task.id);
                toast('완료 처리됨', {
                  action: {
                    label: '되돌리기',
                    onClick: () => onComplete(task.id),
                  },
                });
              }
            : undefined
        }
        onSwipePend={onPend ? () => onPend(task.id) : undefined}
      >
        {withMenu}
      </SwipeActionRow>

      {/* 모바일 바텀 액션 시트 — 롱프레스·⋯ 둘 다 여기로 모인다. 항목 정의는
        * renderActionItems(SHEET_KIT) 한 곳뿐(데스크톱과 동일 정의). coarse·
        * 비편집일 때만 마운트. */}
      {isCoarse && !editing && (
        <TaskActionSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setDeleteArmed(false);
          }}
        >
          {renderActionItems(SHEET_KIT)}
        </TaskActionSheet>
      )}
    </>
  );
}
