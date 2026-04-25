'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Task, TimeLog } from '@/lib/types';
import { DEFAULT_STATUSES, PRIORITIES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';
import { formatDate, minutesToHoursMinutes, cn, getNotionPageUrl } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { TimerButton } from './timer-button';
import { Trash2, ExternalLink, ChevronDown, Clock, Save, X } from 'lucide-react';

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailPanel({ taskId, onClose, onTaskUpdated }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [timelogs, setTimelogs] = useState<TimeLog[]>([]);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requester, setRequester] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [taskData, logsData, statusData] = await Promise.all([
        apiFetch<Task>(`/api/tasks/${taskId}`, { suppressToast: true }),
        apiFetch<TimeLog[]>(`/api/tasks/${taskId}/timelogs`, { suppressToast: true }),
        apiFetch<{ name: string }[]>('/api/custom-statuses', { suppressToast: true }),
      ]);
      setTask(taskData);
      setTimelogs(logsData);
      setCustomStatuses(statusData.map(s => s.name));
      // Populate form
      setTitle(taskData.title);
      setDescription(taskData.description ?? '');
      setStatus(taskData.status);
      setPriority(taskData.priority);
      setDelegateTo(taskData.delegate_to ?? '');
      setDeadline(taskData.deadline?.slice(0, 10) ?? '');
      setRequester(taskData.requester ?? '');
      setFollowUpNote(taskData.follow_up_note ?? '');
    } catch {
      toast.error('task를 불러올 수 없습니다');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, onClose]);

  useEffect(() => {
    if (taskId) fetchTask();
  }, [taskId, fetchTask]);

  // Instant save for dropdowns (status, priority)
  const handleInstantSave = async (field: string, value: string) => {
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      onTaskUpdated?.();
    } catch {
      // error toasted by apiFetch
    }
  };

  const handleStatusChange = (v: string | null) => {
    if (!v) return;
    setStatus(v);
    handleInstantSave('status', v);
  };

  const handlePriorityChange = (v: string | null) => {
    if (!v) return;
    setPriority(v);
    handleInstantSave('priority', v);
  };

  // Explicit save for text fields
  const handleSave = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null,
          delegate_to: delegateTo || null,
          deadline: deadline || null,
          requester: requester || null,
          follow_up_note: followUpNote || null,
        }),
      });
      toast.success('저장되었습니다');
      onTaskUpdated?.();
    } catch {
      // error toasted by apiFetch
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('task가 삭제되었습니다');
      onClose();
      onTaskUpdated?.();
    } catch {
      // error toasted by apiFetch
    }
  };

  const hiddenStatuses = useHiddenStatuses();
  const allStatuses = [...DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s)), ...customStatuses];

  return (
    <>
      <Sheet open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">task 상세</SheetTitle>
          </SheetHeader>

          {loading && !task ? (
            <div className="space-y-4 mt-4 px-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : task ? (
            <div className={cn("space-y-5 mt-4 px-4 pb-4", loading && "opacity-50 transition-opacity")}>
              {/* Title (editable) */}
              <div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={async () => {
                    if (task && title !== task.title && title.trim()) {
                      try {
                        await apiFetch(`/api/tasks/${taskId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title }),
                        });
                        onTaskUpdated?.();
                      } catch {}
                    }
                  }}
                  className="text-lg font-semibold border border-transparent hover:border-border focus:border-border px-2 py-1 rounded transition-colors shadow-none focus-visible:ring-1"
                  style={{ fontFamily: 'var(--font-heading)' }}
                />
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.source === 'notion' && <Badge className="bg-black text-white text-[10px] px-1.5 py-0 rounded">Notion</Badge>}
                  {task.source === 'slack' && <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0 rounded">Slack</Badge>}
                  {task.source === 'notion' && task.notion_task_id && (
                    <a href={getNotionPageUrl(task.notion_task_id)} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Notion에서 보기
                    </a>
                  )}
                  {task.source === 'slack' && task.slack_url && (
                    <a href={task.slack_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Slack에서 보기
                    </a>
                  )}
                  <span>생성: {formatDate(task.created_at, 'yyyy-MM-dd HH:mm')}</span>
                </div>
              </div>

              {/* Quick Action Bar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">상태</Label>
                  <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">우선순위</Label>
                  <Select value={priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">위임 대상</Label>
                  <Input value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} placeholder="담당자 이름" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">마감일</Label>
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">요청자</Label>
                  <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="요청자 없음" />
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground">설명</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="task 설명..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* Collapsible extras */}
              <button
                type="button"
                onClick={() => setShowExtras(!showExtras)}
                aria-expanded={showExtras}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
                추가 정보
              </button>

              {/* Time Sessions — always visible when there are logs */}
              {timelogs.length > 0 && (() => {
                const completedLogs = timelogs.filter(l => l.ended_at);
                const activeLogs = timelogs.filter(l => !l.ended_at);
                const totalMinutes = completedLogs.reduce((sum, log) => {
                  return sum + Math.round((new Date(log.ended_at!).getTime() - new Date(log.started_at).getTime()) / 60000);
                }, 0);

                return (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <Clock className="h-3 w-3" /> 작업 세션 기록
                    </Label>
                    <div className="space-y-1.5">
                      {timelogs.map((log, index) => {
                        const isActive = !log.ended_at;
                        const duration = log.ended_at
                          ? Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000)
                          : 0;
                        return (
                          <div key={log.id} className={cn(
                            "group flex items-center justify-between text-xs rounded px-2 py-1",
                            isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                          )}>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/60 w-6">#{timelogs.length - index}</span>
                              <span>{formatDate(log.started_at, 'MM/dd HH:mm')}</span>
                              {log.ended_at && (
                                <span>→ {formatDate(log.ended_at, 'HH:mm')}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("font-mono tabular-nums", isActive && "animate-pulse")}>
                                {isActive ? '진행중' : minutesToHoursMinutes(duration)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteLogId(log.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-0.5 rounded"
                                aria-label="세션 삭제"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total accumulated time */}
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">총 작업 시간</span>
                      <span className="font-mono tabular-nums text-foreground">
                        {minutesToHoursMinutes(totalMinutes)}
                        {activeLogs.length > 0 && ' + 진행중'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {showExtras && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-xs text-muted-foreground">후속 작업 메모</Label>
                    <Textarea value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} rows={2} />
                  </div>
                  {task.slack_url && (
                    <a href={task.slack_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Slack 메시지 보기
                    </a>
                  )}
                </div>
              )}

              <Separator />

              {/* Footer actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TimerButton taskId={task.id} actualDuration={task?.actual_duration} onTimerChange={() => { fetchTask(); onTaskUpdated?.(); }} />
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> 삭제
                  </Button>
                </div>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!confirmDeleteLogId}
        onOpenChange={(open) => !open && setConfirmDeleteLogId(null)}
        title="세션 삭제"
        description="이 타이머 세션을 삭제합니다. 총 작업 시간에서 제외됩니다."
        confirmLabel="삭제"
        onConfirm={async () => {
          if (!confirmDeleteLogId || !taskId) return;
          try {
            await apiFetch(`/api/tasks/${taskId}/timelogs/${confirmDeleteLogId}`, { method: 'DELETE' });
            toast.success('세션이 삭제되었습니다');
            fetchTask();
            onTaskUpdated?.();
          } catch {}
          setConfirmDeleteLogId(null);
        }}
      />
    </>
  );
}
