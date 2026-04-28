'use client';

import { useEffect, useMemo, useState } from 'react';
import { Issue, Task, isTaskDone } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  currentIssueId?: string | null;
  onPick: (issueId: string) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
}

export function IssuePicker({ open, onClose, currentIssueId, onPick, onCreate }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setShowClosed(false);
    Promise.all([
      apiFetch<Issue[]>('/api/issues'),
      apiFetch<Task[]>('/api/tasks?deleted=false'),
    ])
      .then(([is, ts]) => {
        setIssues(is);
        setTasks(ts);
      })
      .catch(() => {});
  }, [open]);

  // 한 ISSUE의 top-level task가 1개 이상이고 모두 처리됨(완료/위임)이면
  // close 상태로 본다. task가 없는 신규 ISSUE는 close가 아니다.
  const closedIssueIds = useMemo(() => {
    const tasksByIssue = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_task_id) continue;
      if (!t.issue_id) continue;
      const arr = tasksByIssue.get(t.issue_id) ?? [];
      arr.push(t);
      tasksByIssue.set(t.issue_id, arr);
    }
    const closed = new Set<string>();
    for (const [issueId, list] of tasksByIssue) {
      if (list.length > 0 && list.every(t => isTaskDone(t.status))) {
        closed.add(issueId);
      }
    }
    return closed;
  }, [tasks]);

  const trimmed = q.trim();
  const matches = (i: Issue) => i.name.toLowerCase().includes(q.toLowerCase());

  // 검색 중에는 closed/active 모두 매칭. 검색 없을 때만 closed 숨김 토글 적용.
  // 단, 현재 연결된 ISSUE가 closed 라도 사용자가 그 상태를 인지하도록 노출.
  const visible = useMemo(() => {
    return issues.filter(i => {
      if (!matches(i)) return false;
      if (trimmed) return true;
      if (showClosed) return true;
      if (i.id === currentIssueId) return true;
      return !closedIssueIds.has(i.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, q, trimmed, showClosed, closedIssueIds, currentIssueId]);

  const hiddenClosedCount = useMemo(() => {
    if (trimmed || showClosed) return 0;
    return issues.filter(
      i => closedIssueIds.has(i.id) && i.id !== currentIssueId && matches(i),
    ).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, closedIssueIds, currentIssueId, trimmed, showClosed]);

  const exactMatch = !!trimmed && visible.some(i => i.name === trimmed);

  const handlePick = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await onPick(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (busy || !trimmed) return;
    setBusy(true);
    try {
      await onCreate(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ISSUE 선택</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="검색하거나 새 ISSUE 이름 입력"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && trimmed && !exactMatch) {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
          {visible.length === 0 && !trimmed && (
            <p className="text-xs text-muted-foreground py-3 text-center">
              {issues.length === 0
                ? '아직 ISSUE가 없습니다. 위에 이름을 입력하면 새로 만들 수 있어요.'
                : '진행 중인 ISSUE가 없어요.'}
            </p>
          )}
          {visible.map(i => {
            const isCurrent = i.id === currentIssueId;
            const isClosed = closedIssueIds.has(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => handlePick(i.id)}
                disabled={busy || isCurrent}
                className={cn(
                  'w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors',
                  isCurrent
                    ? 'bg-accent/30 cursor-default'
                    : 'hover:bg-accent disabled:opacity-50',
                  isClosed && 'opacity-60',
                )}
              >
                <span className="inline-flex items-center justify-center text-[9px] font-semibold tracking-wide px-1.5 h-4 rounded-sm bg-primary/10 text-primary flex-shrink-0">
                  ISSUE
                </span>
                <span className={cn('text-sm flex-1 truncate', isClosed && 'line-through text-muted-foreground')}>
                  {i.name}
                </span>
                {isClosed && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">완료</span>
                )}
                {isCurrent && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            );
          })}
          {trimmed && !exactMatch && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 justify-start"
              onClick={handleCreate}
              disabled={busy}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              &ldquo;{trimmed}&rdquo; ISSUE 새로 만들기
            </Button>
          )}
        </div>
        {(hiddenClosedCount > 0 || showClosed) && !trimmed && (
          <button
            type="button"
            onClick={() => setShowClosed(v => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline self-start"
          >
            {showClosed
              ? '완료된 ISSUE 숨기기'
              : `완료된 ISSUE도 보기 (${hiddenClosedCount})`}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
