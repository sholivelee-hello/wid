'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STATUS_ICONS } from '@/lib/constants';
import { useAllStatuses } from '@/lib/use-all-statuses';
import { useDefaultStatusRenames } from '@/lib/status-renames';
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
  MessageSquare,
  Sun,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  /** Optional hierarchy label rendered as a small badge before the title. */
  hierarchyLabel?: 'TASK' | 'sub-TASK';
  /** When provided, clicking the card body invokes this instead of opening the detail panel.
   *  The title text becomes the path to the detail panel. */
  onCardClick?: () => void;
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
  onCardClick,
  breadcrumb,
  editing = false,
  onCloseEdit,
}: TaskCardProps) {
  const openDetail = () => {
    if (onSelect) onSelect(task.id);
    else window.location.href = `/tasks/${task.id}`;
  };
  const handleCardActivate = onCardClick ?? openDetail;
  const allStatuses = useAllStatuses();
  const defaultRenames = useDefaultStatusRenames();

  const isCompleted = task.status === '완료';

  const [isTodayTask, setIsTodayTask] = useState(() => getTodayTaskIds().has(task.id));

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
    onStatusChange?.(task.id, val);
  };

  return (
    <Card
      tabIndex={0}
      className={cn(
        'group/card relative bg-card border border-border/60 rounded-xl shadow-sm transition-colors duration-150 cursor-pointer',
        'hover:bg-accent/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isCompleted && 'opacity-60',
        editing && 'ring-1 ring-primary/40',
      )}
      onClick={handleCardActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCardActivate();
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3.5">
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
                onClick={(e) => { e.stopPropagation(); onComplete?.(task.id); }}
                title={
                  blocked
                    ? 'sub-TASK가 모두 완료되어야 완료할 수 있습니다'
                    : isCompleted ? '완료 취소' : '완료 처리'
                }
                aria-label={
                  blocked
                    ? '완료 불가 (sub-TASK 미완료)'
                    : isCompleted ? '완료 취소' : '완료 처리'
                }
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
                ) : (
                  <Circle
                    className={cn(
                      'h-[18px] w-[18px]',
                      blocked
                        ? 'text-muted-foreground/40'
                        : 'text-muted-foreground/50 hover:text-emerald-500 transition-colors',
                    )}
                  />
                )}
              </button>
            );
          })()}

          {/* Title + metadata */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {breadcrumb && (breadcrumb.issueName || breadcrumb.parentTaskTitle) && (
              <div className="text-[10px] text-muted-foreground/80 truncate">
                {breadcrumb.issueName && (
                  <span className="font-medium">{breadcrumb.issueName}</span>
                )}
                {breadcrumb.issueName && breadcrumb.parentTaskTitle && (
                  <span className="mx-1">›</span>
                )}
                {breadcrumb.parentTaskTitle && (
                  <span>{breadcrumb.parentTaskTitle}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              {hierarchyLabel && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center text-[9px] font-semibold tracking-wide px-1.5 h-4 rounded-sm flex-shrink-0',
                    hierarchyLabel === 'TASK'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
                  )}
                  aria-hidden
                >
                  {hierarchyLabel}
                </span>
              )}
              {onCardClick ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openDetail(); }}
                  className={cn(
                    'font-medium text-sm leading-snug truncate text-left hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded',
                    isCompleted && 'line-through text-muted-foreground',
                  )}
                  title="상세 보기"
                >
                  {task.title}
                </button>
              ) : (
                <span className={cn(
                  'font-medium text-sm leading-snug truncate',
                  isCompleted && 'line-through text-muted-foreground'
                )}>
                  {task.title}
                </span>
              )}
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
                  {defaultRenames[task.status] ?? task.status}
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(({ original, display }) => {
                    const Icon = STATUS_ICONS[original];
                    return (
                      <SelectItem key={original} value={original}>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span>{display}</span>
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
                    toggleTodayTask(task.id);
                  }}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  {isTodayTask ? '오늘에서 제거' : '오늘에 추가'}
                </DropdownMenuItem>
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
          <div className="mt-4 pt-4 border-t border-border/40">
            <TaskInlineEditor
              task={task}
              onClose={() => onCloseEdit?.()}
            />
          </div>
        )}
      </CardContent>

    </Card>
  );
}
