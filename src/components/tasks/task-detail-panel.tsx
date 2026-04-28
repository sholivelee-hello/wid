'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Issue, Task, TASK_STATUSES } from '@/lib/types';
import { PRIORITIES } from '@/lib/constants';
import { formatDate, cn, getNotionPageUrl } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { IssuePicker } from '@/components/issues/issue-picker';
import { Trash2, ExternalLink, ChevronDown, Save, X, FolderPlus, ArrowUpRight, CornerLeftUp, CheckCircle2, Circle } from 'lucide-react';

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
  /** Optional: lets the panel navigate to a related task (parent / sibling /
   * child) without closing. Today page wires this so users can drill up to
   * the parent TASK context from a hoisted sub-TASK row. */
  onNavigate?: (taskId: string) => void;
}

export function TaskDetailPanel({ taskId, onClose, onTaskUpdated, onNavigate }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [siblings, setSiblings] = useState<Task[]>([]);
  const [children, setChildren] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);

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
      const [taskData, issueData, allTasks] = await Promise.all([
        apiFetch<Task>(`/api/tasks/${taskId}`, { suppressToast: true }),
        apiFetch<Issue[]>('/api/issues', { suppressToast: true }),
        apiFetch<Task[]>(`/api/tasks?deleted=false`, { suppressToast: true }),
      ]);
      setTask(taskData);
      setIssues(issueData);
      setTitle(taskData.title);
      setDescription(taskData.description ?? '');
      setStatus(taskData.status);
      setPriority(taskData.priority);
      setDelegateTo(taskData.delegate_to ?? '');
      setDeadline(taskData.deadline?.slice(0, 10) ?? '');
      setRequester(taskData.requester ?? '');
      setFollowUpNote(taskData.follow_up_note ?? '');

      // Build relationship context — parent + siblings for sub-TASKs, or
      // children for parent TASKs. This is the answer to "오늘 탭에서 보이는
      // sub-task의 부모/형제/요청자 어떻게 봐?": one fetch, three views.
      if (taskData.parent_task_id) {
        const parent = allTasks.find(t => t.id === taskData.parent_task_id) ?? null;
        setParentTask(parent);
        setSiblings(
          allTasks
            .filter(t => t.parent_task_id === taskData.parent_task_id && t.id !== taskData.id)
            .sort((a, b) => a.position - b.position),
        );
        setChildren([]);
      } else {
        setParentTask(null);
        setSiblings([]);
        setChildren(
          allTasks
            .filter(t => t.parent_task_id === taskData.id)
            .sort((a, b) => a.position - b.position),
        );
      }
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, onClose]);

  const currentIssue = task?.issue_id
    ? issues.find(i => i.id === task.issue_id) ?? null
    : null;

  const attachToIssue = async (issueId: string) => {
    if (!taskId) return;
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, parent_task_id: null }),
      });
      setTask(updated);
      onTaskUpdated?.();
    } catch {}
  };

  const createAndAttach = async (name: string) => {
    if (!taskId) return;
    try {
      const issue = await apiFetch<Issue>('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setIssues(prev => [...prev, issue]);
      await attachToIssue(issue.id);
    } catch {}
  };

  const unlinkFromIssue = async () => {
    if (!taskId) return;
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: null }),
      });
      setTask(updated);
      onTaskUpdated?.();
    } catch {}
  };

  useEffect(() => {
    if (taskId) fetchTask();
  }, [taskId, fetchTask]);

  const handleInstantSave = async (field: string, value: string) => {
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      onTaskUpdated?.();
    } catch {}
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
      onTaskUpdated?.();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      onClose();
      onTaskUpdated?.();
    } catch {}
  };


  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
        {/* Center modal — wider than the default sm:max-w-sm so the relation
          * sections (parent / siblings / children) breathe; capped at 85vh so
          * long content scrolls inside the modal instead of pushing the page. */}
        <DialogContent className="!max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 gap-4">
          <DialogHeader>
            <DialogTitle className="text-left text-[15px]">task 상세</DialogTitle>
          </DialogHeader>

          {loading && !task ? (
            <div className="space-y-4 mt-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : task ? (
            <div className={cn('space-y-5 mt-2', loading && 'opacity-50 transition-opacity')}>
              {/* Title */}
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
                  className="text-lg font-bold tracking-[-0.025em] border border-transparent hover:border-border focus:border-border px-2 py-1 rounded transition-colors shadow-none focus-visible:ring-1"
                />
                {task.notion_issue && (
                  <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                    {task.notion_issue}
                  </div>
                )}
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

              {/* Parent context — only for sub-TASKs. Click navigates to the
                * parent's detail; this resolves "I'm looking at a sub-task in
                * Today, how do I see the parent's requester / other subs?" */}
              {parentTask && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CornerLeftUp className="h-3 w-3" />
                    부모 TASK
                  </Label>
                  <button
                    type="button"
                    onClick={() => onNavigate?.(parentTask.id)}
                    disabled={!onNavigate}
                    className={cn(
                      'mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-card text-left transition-colors',
                      onNavigate && 'hover:border-border hover:bg-accent/40 active:scale-[0.99]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 inline-grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold',
                        parentTask.status === '완료'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {parentTask.status === '완료' ? '✓' : '○'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold truncate">{parentTask.title}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                        {parentTask.status}
                        {parentTask.requester ? ` · 요청 ${parentTask.requester}` : ''}
                        {parentTask.deadline ? ` · 마감 ${formatDate(parentTask.deadline, 'M월 d일')}` : ''}
                      </span>
                    </span>
                    {onNavigate && (
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
              )}

              {/* Sibling sub-TASKs — under the same parent, sorted by position. */}
              {siblings.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    같은 부모의 다른 하위 task <span className="text-muted-foreground/70 tabular-nums">({siblings.length})</span>
                  </Label>
                  <ul className="mt-1.5 rounded-lg border border-border/60 divide-y divide-border bg-card overflow-hidden">
                    {siblings.map(s => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate?.(s.id)}
                          disabled={!onNavigate}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                            onNavigate && 'hover:bg-accent/40 active:bg-accent/60',
                            s.status === '완료' && 'opacity-60',
                          )}
                        >
                          {s.status === '완료'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            : <Circle className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />}
                          <span className={cn('flex-1 truncate text-[13px]', s.status === '완료' && 'line-through text-muted-foreground')}>
                            {s.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 flex-shrink-0">
                            {s.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Children — for parent TASKs that have sub-TASKs. */}
              {children.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    하위 task <span className="text-muted-foreground/70 tabular-nums">({children.length})</span>
                  </Label>
                  <ul className="mt-1.5 rounded-lg border border-border/60 divide-y divide-border bg-card overflow-hidden">
                    {children.map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate?.(c.id)}
                          disabled={!onNavigate}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                            onNavigate && 'hover:bg-accent/40 active:bg-accent/60',
                            c.status === '완료' && 'opacity-60',
                          )}
                        >
                          {c.status === '완료'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            : <Circle className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />}
                          <span className={cn('flex-1 truncate text-[13px]', c.status === '완료' && 'line-through text-muted-foreground')}>
                            {c.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 flex-shrink-0">
                            {c.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ISSUE */}
              <div>
                <Label className="text-xs text-muted-foreground">ISSUE</Label>
                {task.parent_task_id ? (
                  <div className="mt-1 text-xs text-muted-foreground px-2 py-1.5">
                    sub-TASK는 부모 TASK를 통해 ISSUE에 연결됩니다.
                  </div>
                ) : currentIssue ? (
                  <div className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/30 border border-border/40">
                    <span className="inline-flex items-center justify-center text-[9px] font-semibold tracking-wide px-1.5 h-4 rounded-sm bg-primary/10 text-primary flex-shrink-0">
                      ISSUE
                    </span>
                    <span className="text-sm flex-1 truncate">{currentIssue.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setIssuePickerOpen(true)}
                    >
                      변경
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={unlinkFromIssue}
                    >
                      <X className="h-3 w-3 mr-0.5" />
                      분리
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIssuePickerOpen(true)}
                    >
                      <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                      ISSUE 연결
                    </Button>
                  </div>
                )}
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">상태</Label>
                  <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
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

              <div>
                <Label className="text-xs text-muted-foreground">설명</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="task 설명..." rows={3} className="mt-1" />
              </div>

              <button
                type="button"
                onClick={() => setShowExtras(!showExtras)}
                aria-expanded={showExtras}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
                추가 정보
              </button>

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

              <div className="flex items-center justify-between">
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> 삭제
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
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
