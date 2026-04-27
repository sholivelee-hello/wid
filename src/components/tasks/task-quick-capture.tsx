'use client';

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Task, Issue, Priority } from '@/lib/types';
import { PRIORITIES } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IssuePicker } from '@/components/issues/issue-picker';
import { TaskChipButton } from '@/components/tasks/task-chip-button';
import { DeadlinePopover } from '@/components/tasks/deadline-popover';
import { apiFetch } from '@/lib/api';
import { Loader2, CornerDownLeft, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type TaskQuickCaptureSurface = 'inline' | 'modal';

export interface TaskQuickCaptureProps {
  surface: TaskQuickCaptureSurface;
  onCreated?: (task: Task) => void;
  defaultIssueId?: string | null;
  /** Modal: emitted on Enter (closes modal). Inline ignores. */
  onSubmittedClose?: () => void;
  /** Modal: auto-focus input on mount. Inline does not auto-focus. */
  autoFocus?: boolean;
}

export interface TaskQuickCaptureHandle {
  focus: () => void;
}

export const TaskQuickCapture = forwardRef<TaskQuickCaptureHandle, TaskQuickCaptureProps>(
  function TaskQuickCapture({ surface, onCreated, defaultIssueId = null, onSubmittedClose, autoFocus }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Priority>('보통');
    const [deadline, setDeadline] = useState<string | null>(null);
    const [issueId, setIssueId] = useState<string | null>(defaultIssueId);
    const [issueName, setIssueName] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [issuePickerOpen, setIssuePickerOpen] = useState(false);
    const [priorityOpen, setPriorityOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
      if (!issueId) { setIssueName(null); return; }
      let cancel = false;
      apiFetch<Issue[]>('/api/issues').then(list => {
        if (cancel) return;
        const i = list.find(x => x.id === issueId);
        if (i) setIssueName(i.name);
      }).catch(() => {});
      return () => { cancel = true; };
    }, [issueId]);

    const chipsTouched =
      priority !== '보통' || deadline !== null || issueId !== defaultIssueId;

    const resetChips = () => {
      setPriority('보통');
      setDeadline(null);
      setIssueId(defaultIssueId);
    };

    const submit = async (opts: { keepOpen: boolean }) => {
      const trimmed = title.trim();
      if (!trimmed || saving) return;
      setSaving(true);
      try {
        const created = await apiFetch<Task>('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmed,
            priority,
            deadline,
            issue_id: issueId,
            parent_task_id: null,
            status: '등록',
            source: 'manual',
          }),
        });
        setTitle('');
        onCreated?.(created);
        window.dispatchEvent(new CustomEvent('task-created'));
        if (surface === 'modal' && !opts.keepOpen) {
          onSubmittedClose?.();
          toast.success('✓ task 추가됨', {
            description: '인박스로 이동',
            action: {
              label: '이동',
              onClick: () => {
                if (typeof window !== 'undefined') window.location.href = '/';
              },
            },
          });
        } else {
          inputRef.current?.focus();
        }
      } catch {
        // apiFetch surfaces errors; preserve state for retry.
      } finally {
        setSaving(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit({ keepOpen: e.shiftKey });
      } else if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
    };

    const handleIssueCreate = async (name: string) => {
      try {
        const created = await apiFetch<Issue>('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        setIssueId(created.id);
        setIssueName(created.name);
      } catch {}
    };

    const issueLabel = issueId && issueName ? issueName : 'ISSUE 연결';

    return (
      <div
        className={cn(
          'rounded-lg border bg-card',
          surface === 'inline' ? 'p-3' : 'p-0',
        )}
      >
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            data-quick-capture-input="true"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="task 추가... (Enter 저장)"
            disabled={saving}
            className="border-0 shadow-none focus-visible:ring-0 px-1 text-sm"
            aria-label="새 task 제목"
          />
          <button
            type="button"
            onClick={() => submit({ keepOpen: false })}
            disabled={saving || !title.trim()}
            className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="저장"
            title="저장 (Enter)"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
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
                    onClick={() => { setPriority(p); setPriorityOpen(false); }}
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

          <DeadlinePopover value={deadline} onChange={setDeadline} />

          <TaskChipButton
            active={issueId !== null}
            icon={<FolderOpen className="h-3 w-3" />}
            onClick={() => setIssuePickerOpen(true)}
          >
            {issueLabel}
          </TaskChipButton>

          {chipsTouched && (
            <button
              type="button"
              onClick={resetChips}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              chip 초기화
            </button>
          )}
        </div>

        <IssuePicker
          open={issuePickerOpen}
          onClose={() => setIssuePickerOpen(false)}
          currentIssueId={issueId}
          onPick={(id) => { setIssueId(id); }}
          onCreate={handleIssueCreate}
        />
      </div>
    );
  },
);
