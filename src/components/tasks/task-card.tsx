'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TimerButton } from './timer-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRIORITY_COLORS, STATUS_COLORS, STATUS_ICONS, DEFAULT_STATUSES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';
import { Task } from '@/lib/types';
import { formatDate, cn, getNotionPageUrl } from '@/lib/utils';
import {
  Circle,
  CheckCircle2,
  MoreHorizontal,
  UserPlus,
  Trash2,
  ExternalLink,
  Clock,
  User,
  CalendarDays,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface TaskCardProps {
  task: Task;
  onTimerChange?: () => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function Dot() {
  return <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>;
}

export function TaskCard({
  task,
  onTimerChange,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
}: TaskCardProps) {
  const hiddenStatuses = useHiddenStatuses();
  const visibleDefaults = DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s));
  const isCompleted = task.status === '완료';
  const isNew = (Date.now() - new Date(task.created_at).getTime()) < 2 * 60 * 60 * 1000;
  const priorityColor = PRIORITY_COLORS[task.priority];
  const statusColor = STATUS_COLORS[task.status] ?? '#6B7280';

  // Deadline calculation
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

  return (
    <Card
      tabIndex={0}
      className={cn(
        'group/card relative bg-card border border-border/60 rounded-xl shadow-sm transition-colors duration-150 cursor-pointer',
        'hover:bg-accent/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isCompleted && 'opacity-60',
      )}
      onClick={() => {
        if (onSelect) onSelect(task.id);
        else window.location.href = `/tasks/${task.id}`;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (onSelect) onSelect(task.id);
          else window.location.href = `/tasks/${task.id}`;
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3.5">
          {/* Completion toggle */}
          <button
            type="button"
            className="flex-shrink-0 -m-1.5 p-1.5 rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => { e.stopPropagation(); onComplete?.(task.id); }}
            aria-label={isCompleted ? '완료 취소' : '완료 처리'}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
            ) : (
              <Circle className="h-[18px] w-[18px] text-muted-foreground/50 hover:text-emerald-500 transition-colors" />
            )}
          </button>

          {/* Title + metadata */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-medium text-sm leading-snug truncate',
                  isCompleted && 'line-through text-muted-foreground'
                )}
              >
                {task.title}
              </span>
              {isNew && (
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse flex-shrink-0"
                  title="최근 2시간 내 생성"
                  aria-label="새 task"
                />
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
              {/* Priority — muted text with colored dot */}
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: priorityColor }}
                  aria-hidden="true"
                />
                {task.priority}
              </span>

              {/* Deadline */}
              {task.deadline && (
                <>
                  <Dot />
                  <span className={cn('inline-flex items-center gap-1', deadlineClass)}>
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                  </span>
                </>
              )}

              {/* Requester */}
              {task.requester && (
                <>
                  <Dot />
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" aria-hidden="true" />
                    {task.requester}
                  </span>
                </>
              )}

              {/* Accumulated time */}
              {task.actual_duration != null && task.actual_duration > 0 && (
                <>
                  <Dot />
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatMinutes(task.actual_duration)}
                  </span>
                </>
              )}

              {/* Source links — subtle icon-only, natural flow (no ml-auto) */}
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

          {/* Actions — consistent h-8 row, visually calm */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Status select — neutral border, muted text, colored dots in dropdown */}
            {onStatusChange ? (
              <Select
                value={task.status}
                onValueChange={(val) => { if (val) onStatusChange(task.id, val); }}
              >
                <SelectTrigger
                  className="h-8 text-xs px-2.5 gap-1.5 border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="상태 변경"
                >
                  {STATUS_ICONS[task.status] && (() => {
                    const Icon = STATUS_ICONS[task.status];
                    return (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: statusColor }}
                          aria-hidden="true"
                        />
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      </span>
                    );
                  })()}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleDefaults.map((s) => {
                    const Icon = STATUS_ICONS[s];
                    return (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLORS[s] }}
                            aria-hidden="true"
                          />
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
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColor }}
                  aria-hidden="true"
                />
                {STATUS_ICONS[task.status] && (() => {
                  const Icon = STATUS_ICONS[task.status];
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {task.status}
              </span>
            )}

            {/* Timer (compact in card context) */}
            <TimerButton
              taskId={task.id}
              actualDuration={task.actual_duration}
              onTimerChange={onTimerChange}
              compact
            />

            {/* Overflow */}
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
                    toast.success('위임으로 변경되었습니다. 위임 대상은 상세 패널에서 입력하세요.');
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  위임
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(task.id);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </DropdownMenuItem>
                {task.slack_url && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(task.slack_url!, '_blank');
                    }}
                  >
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
