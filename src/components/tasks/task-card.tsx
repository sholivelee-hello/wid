'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STATUS_ICONS } from '@/lib/constants';
import { TASK_STATUSES, type TaskStatus } from '@/lib/types';
import { Task } from '@/lib/types';
import { formatDate, cn, getNotionPageUrl } from '@/lib/utils';
import { toggleTodayTask, getTodayTaskIds } from '@/lib/today-tasks';
import { TaskInlineEditor } from '@/components/tasks/task-inline-editor';
import {
  Circle,
  CheckCircle2,
  MoreHorizontal,
  UserPlus,
  Trash2,
  ExternalLink,
  User,
  CalendarDays,
  FileText,
  FolderOpen,
  MessageSquare,
  Sun,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
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
}

function Dot() {
  return <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>;
}

export function TaskCard({
  task,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
  hierarchyLabel,
  isSubtask = false,
  hasChildren = false,
  breadcrumb,
  editing = false,
  onCloseEdit,
}: TaskCardProps) {
  const openDetail = () => {
    if (onSelect) onSelect(task.id);
    else window.location.href = `/tasks/${task.id}`;
  };
  const isCompleted = task.status === '완료';

  const [isTodayTask, setIsTodayTask] = useState(() => getTodayTaskIds().has(task.id));
  const [completePulse, setCompletePulse] = useState(0);
  const [todayPulse, setTodayPulse] = useState(0);

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
    if (d < today && task.status !== '완료') deadlineSuffix = ' · 기한 초과';
    else if (d.toDateString() === today.toDateString()) deadlineSuffix = ' · 오늘';
  }

  const handleStatusSelect = (val: string | null) => {
    if (!val) return;
    if (!(TASK_STATUSES as readonly string[]).includes(val)) return;
    onStatusChange?.(task.id, val as TaskStatus);
  };

  return (
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
        isCompleted && 'opacity-55',
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
      {editing && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}
      <div className={cn(isSubtask ? 'px-3 py-2' : 'px-3 py-3')}>
        <div className="flex items-center gap-3">
          {/* Completion toggle */}
          {(() => {
            const blocked = !onComplete && !isCompleted;
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
                    : isCompleted ? '완료 취소' : '완료 처리'
                }
                aria-label={
                  blocked
                    ? '완료 불가 (하위 task 미완료)'
                    : isCompleted ? '완료 취소' : '완료 처리'
                }
              >
                {/* Unified wrapper for both states — keeps the button's
                  * inline-content metrics stable across toggle so the row
                  * doesn't drift up/down 1-2px when status flips. */}
                <span
                  className="relative inline-grid place-items-center h-[18px] w-[18px] align-middle"
                  aria-hidden
                >
                  {isCompleted ? (
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

          {/* 1-tap "오늘 토글" */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTodayPulse(p => p + 1);
              toggleTodayTask(task.id);
            }}
            className={cn(
              'flex-shrink-0 -ml-2 -my-1.5 p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isTodayTask
                ? 'text-primary hover:text-primary/80'
                : 'text-muted-foreground/30 group-hover/card:text-muted-foreground hover:text-primary',
            )}
            aria-pressed={isTodayTask}
            aria-label={isTodayTask ? '오늘에서 제거' : '오늘에 추가'}
            title={isTodayTask ? '오늘 묶음에서 빼기' : '오늘 할 일로 등록'}
          >
            <Sun
              key={`sun-${todayPulse}`}
              className={cn(
                'h-4 w-4',
                isTodayTask && 'fill-primary',
                todayPulse > 0 && 'animate-today-pulse',
              )}
            />
          </button>

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
              <span
                className={cn(
                  'leading-snug truncate tracking-[-0.012em]',
                  isSubtask
                    ? 'text-[13px] font-normal text-foreground/80'
                    : hasChildren
                      ? 'text-[14.5px] font-semibold text-foreground'
                      : 'text-[14px] font-medium text-foreground',
                  isCompleted && 'line-through text-muted-foreground',
                )}
                title={task.title}
              >
                {task.title}
              </span>
            </div>

            {task.notion_issue && (
              <div className="text-xs text-muted-foreground/70 truncate">
                {task.notion_issue}
              </div>
            )}

            <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
              {task.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                </span>
              )}

              {task.requester && (
                <>
                  <Dot />
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" aria-hidden="true" />
                    {task.requester}
                  </span>
                </>
              )}

              {task.source === 'notion' && task.notion_task_id && (
                <>
                  <Dot />
                  <a
                    href={getNotionPageUrl(task.notion_task_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Notion에서 보기"
                    aria-label="Notion에서 보기"
                  >
                    <FileText className="h-3 w-3" />
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </>
              )}
              {task.source === 'slack' && task.slack_url && (
                <>
                  <Dot />
                  <a
                    href={task.slack_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Slack에서 보기"
                    aria-label="Slack에서 보기"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {onStatusChange ? (
              <Select value={task.status} onValueChange={handleStatusSelect}>
                <SelectTrigger
                  className="h-7 text-[11px] px-2.5 rounded-full border border-border/60 bg-background text-foreground hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring min-w-0"
                  aria-label="상태 변경"
                >
                  {task.status}
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => {
                    const Icon = STATUS_ICONS[s];
                    return (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span>{s}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-8 text-xs px-2.5 rounded-md border border-border text-muted-foreground">
                {STATUS_ICONS[task.status] && (() => {
                  const Icon = STATUS_ICONS[task.status];
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {task.status}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center rounded-md h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="더 보기"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange?.(task.id, '위임');
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  위임
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </DropdownMenuItem>
                {task.slack_url && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(task.slack_url!, '_blank'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Slack 보기
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
}
