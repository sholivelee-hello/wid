'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IssuePicker } from '@/components/issues/issue-picker';
import { TaskChipButton } from '@/components/tasks/task-chip-button';
import { DeadlinePopover } from '@/components/tasks/deadline-popover';
import { Issue, Task, TASK_STATUSES } from '@/lib/types';
import { PRIORITIES } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import { promptNextInTodayIfNeeded } from '@/lib/today-tasks';
import { Check, Loader2, Trash2, X, FolderOpen, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskInlineEditor({ task, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [deadline, setDeadline] = useState<string | null>(task.deadline?.slice(0, 10) ?? null);
  const [requester, setRequester] = useState(task.requester ?? '');
  const [delegateTo, setDelegateTo] = useState(task.delegate_to ?? '');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedIssueId, setLinkedIssueId] = useState<string | null>(task.issue_id);

  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  // Auto-expand the optional section when task already has any of its values.
  const [moreOpen, setMoreOpen] = useState(
    !!(task.requester || task.delegate_to || task.description),
  );

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const savedAtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<Issue[]>('/api/issues', { suppressToast: true })
      .then(setIssues).catch(() => {});
  }, []);

  useEffect(() => {
    if (savedAt === null) return;
    if (savedAtTimerRef.current) clearTimeout(savedAtTimerRef.current);
    savedAtTimerRef.current = setTimeout(() => setSavedAt(null), 1500);
    return () => {
      if (savedAtTimerRef.current) clearTimeout(savedAtTimerRef.current);
    };
  }, [savedAt]);

  const currentIssue = linkedIssueId
    ? issues.find(i => i.id === linkedIssueId) ?? null
    : null;

  const save = async (patch: Record<string, unknown>) => {
    try {
      setSaving(true);
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
      setSavedAt(Date.now());
      if (patch.status === '완료' && task.status !== '완료') {
        promptNextInTodayIfNeeded({ ...task, status: '완료' });
      }
    } finally {
      setSaving(false);
    }
  };

  const attachToIssue = async (issueId: string) => {
    setLinkedIssueId(issueId);
    await save({ issue_id: issueId, parent_task_id: null });
  };

  const createAndAttach = async (name: string) => {
    const issue = await apiFetch<Issue>('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setIssues(prev => [...prev, issue]);
    await attachToIssue(issue.id);
  };

  const unlinkFromIssue = async () => {
    setLinkedIssueId(null);
    await save({ issue_id: null });
  };

  const handleDelete = async () => {
    await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    window.dispatchEvent(new CustomEvent('task-updated'));
    onClose();
  };

  const issueChipLabel = currentIssue ? currentIssue.name : 'ISSUE 연결';

  return (
    <div
      className="space-y-3"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">인라인 편집</span>
        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={onClose}
            aria-label="편집 닫기"
          >
            <X className="h-3.5 w-3.5 mr-1" /> 닫기
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== task.title) save({ title: title.trim() });
        }}
        aria-label="제목"
      />

      {/* Compact chip row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Status chip */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger
            render={
              <TaskChipButton active>
                {status}
              </TaskChipButton>
            }
          />
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

        {/* Priority chip */}
        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger
            render={
              <TaskChipButton
                active={priority !== '보통'}
                variant={priority === '긴급' ? 'destructive' : 'default'}
              >
                {priority}
              </TaskChipButton>
            }
          />
          <PopoverContent className="w-32 p-1" align="start">
            <div className="flex flex-col">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriorityOpen(false);
                    if (p === priority) return;
                    setPriority(p);
                    save({ priority: p });
                  }}
                  className={cn(
                    'text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors',
                    p === priority && 'font-semibold',
                    p === '긴급' && 'text-destructive',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Deadline chip */}
        <DeadlinePopover
          value={deadline}
          onChange={(v) => {
            setDeadline(v);
            save({ deadline: v });
          }}
        />

        {/* ISSUE chip — only for top-level TASKs */}
        {!task.parent_task_id && (
          <TaskChipButton
            active={currentIssue !== null}
            icon={<FolderOpen className="h-3 w-3" />}
            caret={currentIssue === null}
            onClick={() => setIssuePickerOpen(true)}
            trailing={
              currentIssue !== null ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="ISSUE 분리"
                  className="ml-0.5 -mr-0.5 inline-flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); unlinkFromIssue(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      unlinkFromIssue();
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              ) : null
            }
          >
            {issueChipLabel}
          </TaskChipButton>
        )}
      </div>

      {/* "더 보기" toggle */}
      <button
        type="button"
        onClick={() => setMoreOpen(v => !v)}
        aria-expanded={moreOpen}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', !moreOpen && '-rotate-90')} />
        더 보기
      </button>

      {moreOpen && (
        <div className="space-y-3 animate-in fade-in-0 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">요청자</Label>
              <Input
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                onBlur={() => {
                  if ((requester || null) !== (task.requester || null)) {
                    save({ requester: requester || null });
                  }
                }}
                placeholder="요청자 없음"
              />
            </div>
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
                placeholder="담당자 이름"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if ((description || null) !== (task.description || null)) {
                  save({ description: description || null });
                }
              }}
              rows={3}
              placeholder="task 설명..."
            />
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> 삭제
            </Button>
          </div>
        </div>
      )}

      <IssuePicker
        open={issuePickerOpen}
        onClose={() => setIssuePickerOpen(false)}
        currentIssueId={linkedIssueId}
        onPick={attachToIssue}
        onCreate={createAndAttach}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={task.parent_task_id ? 'sub-TASK 삭제' : 'TASK 삭제'}
        description={
          task.parent_task_id
            ? '이 sub-TASK를 휴지통으로 이동합니다.'
            : '이 TASK를 휴지통으로 이동합니다.'
        }
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />
    </div>
  );
}
