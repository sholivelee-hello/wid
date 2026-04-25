'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IssuePicker } from '@/components/issues/issue-picker';
import { Issue, Task } from '@/lib/types';
import { DEFAULT_STATUSES, PRIORITIES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';
import { useDefaultStatusRenames } from '@/lib/status-renames';
import { apiFetch } from '@/lib/api';
import { Trash2, X, FolderPlus } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskInlineEditor({ task, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [deadline, setDeadline] = useState(task.deadline?.slice(0, 10) ?? '');
  const [requester, setRequester] = useState(task.requester ?? '');
  const [delegateTo, setDelegateTo] = useState(task.delegate_to ?? '');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [linkedIssueId, setLinkedIssueId] = useState<string | null>(task.issue_id);

  const hiddenStatuses = useHiddenStatuses();
  const defaultRenames = useDefaultStatusRenames();
  const visibleDefaultStatuses = DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s));

  useEffect(() => {
    apiFetch<Issue[]>('/api/issues', { suppressToast: true })
      .then(setIssues).catch(() => {});
    apiFetch<{ name: string }[]>('/api/custom-statuses', { suppressToast: true })
      .then(d => setCustomStatuses(d.map(s => s.name))).catch(() => {});
  }, []);

  const currentIssue = linkedIssueId
    ? issues.find(i => i.id === linkedIssueId) ?? null
    : null;

  const save = async (patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        suppressToast: true,
      });
      window.dispatchEvent(new CustomEvent('task-updated'));
    } catch {}
  };

  const attachToIssue = async (issueId: string) => {
    setLinkedIssueId(issueId);
    await save({ issue_id: issueId, parent_task_id: null });
  };

  const createAndAttach = async (name: string) => {
    try {
      const issue = await apiFetch<Issue>('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        suppressToast: true,
      });
      setIssues(prev => [...prev, issue]);
      await attachToIssue(issue.id);
    } catch {}
  };

  const unlinkFromIssue = async () => {
    setLinkedIssueId(null);
    await save({ issue_id: null });
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE', suppressToast: true });
      window.dispatchEvent(new CustomEvent('task-updated'));
      onClose();
    } catch {}
  };

  return (
    <div
      className="space-y-3"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">인라인 편집</span>
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

      <div>
        <Label className="text-xs text-muted-foreground">제목</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== task.title) save({ title: title.trim() });
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">상태</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              if (!v) return;
              setStatus(v);
              save({ status: v });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {visibleDefaultStatuses.map(s => (
                <SelectItem key={s} value={s}>{defaultRenames[s] ?? s}</SelectItem>
              ))}
              {customStatuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">우선순위</Label>
          <Select
            value={priority}
            onValueChange={(v) => {
              if (!v) return;
              setPriority(v as typeof priority);
              save({ priority: v });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">마감일</Label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              save({ deadline: e.target.value || null });
            }}
          />
        </div>
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

      {!task.parent_task_id && (
        <div>
          <Label className="text-xs text-muted-foreground">ISSUE</Label>
          {currentIssue ? (
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
                <X className="h-3 w-3 mr-0.5" /> 분리
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
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" /> ISSUE 연결
              </Button>
            </div>
          )}
        </div>
      )}

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
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다."
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />
    </div>
  );
}
