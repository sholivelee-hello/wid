'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRIORITY_COLORS, STATUS_ICONS, getContrastTextColor } from '@/lib/constants';
import { getStatusColor } from '@/lib/status-colors';
import { useAllStatuses } from '@/lib/use-all-statuses';
import { useDefaultStatusRenames } from '@/lib/status-renames';
import { Task } from '@/lib/types';
import { formatDate, cn, getNotionPageUrl } from '@/lib/utils';
import { toggleTodayTask, getTodayTaskIds } from '@/lib/today-tasks';
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
}: TaskCardProps) {
  const openDetail = () => {
    if (onSelect) onSelect(task.id);
    else window.location.href = `/tasks/${task.id}`;
  };
  const handleCardActivate = onCardClick ?? openDetail;
  const allStatuses = useAllStatuses();
  const defaultRenames = useDefaultStatusRenames();

  const isCompleted = task.status === '완료';
  const isNew = (Date.now() - new Date(task.created_at).getTime()) < 2 * 60 * 60 * 1000;
  const priorityColor = PRIORITY_COLORS[task.priority];
  const statusColor = allStatuses.find(s => s.original === task.status)?.color ?? getStatusColor(task.status);

  const [isTodayTask, setIsTodayTask] = useState(() => getTodayTaskIds().has(task.id));

  useEffect(() => {
    const handler = () => setIsTodayTask(getTodayTaskIds().has(task.id));
    window.addEventListener('today-tasks-changed', handler);
    return () => window.removeEventListener('today-tasks-changed', handler);
  }, [task.id]);

  let deadlineTone: 'overdue' | 'today' | 'soon' | 'normal' = 'normal';
  if (task.deadline) {
    const d = new Date(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today && task.status !== '완료') deadlineTone = 'overdue';
    else if (d.toDateString() === today.toDateString()) deadlineTone = 'today';
    else if ((d.getTime() - today.getTime()) < 3 * 24 * 60 * 60 * 1000) deadlineTone = 'soon';
  }
  const deadlineClass = {
    overdue: 'text-red-600 dark:text-red-400 font-medium',
    today: 'text-amber-600 dark:text-amber-400 font-medium',
    soon: 'text-amber-600/80 dark:text-amber-400/80',
    normal: 'text-muted-foreground',
  }[deadlineTone];
  const deadlineSuffix =
    deadlineTone === 'overdue' ? ' · 기한 초과' :
    deadlineTone === 'today' ? ' · 오늘' : '';

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
        task.priority === '긴급' && 'border-l-[3px] border-l-red-500',
        task.priority === '높음' && 'border-l-[3px] border-l-amber-500',
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
              {isNew && (
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse flex-shrink-0"
                  title="최근 2시간 내 생성"
                  aria-label="새 task"
                />
              )}
            </div>

            {task.notion_issue && (
              <div className="text-xs text-muted-foreground/70 truncate">
                {task.notion_issue}
              </div>
            )}

            <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
              {task.deadline && (
                <>
                  <span className={cn('inline-flex items-center gap-1', deadlineClass)}>
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                  </span>
                </>
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
                  className="h-7 text-[11px] px-2.5 border-0 rounded-full font-semibold focus-visible:ring-2 focus-visible:ring-ring min-w-0"
                  style={{ backgroundColor: statusColor, color: getContrastTextColor(statusColor) }}
                  aria-label="상태 변경"
                >
                  {defaultRenames[task.status] ?? task.status}
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(({ original, display, color: optColor }) => {
                    const Icon = STATUS_ICONS[original];
                    return (
                      <SelectItem key={original} value={original}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: optColor }} aria-hidden="true" />
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
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} aria-hidden="true" />
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
      </CardContent>

    </Card>
  );
}
