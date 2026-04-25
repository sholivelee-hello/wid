'use client';

import { useState, useEffect } from 'react';
import { Issue } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface Props {
  issue: Issue | null;
  taskCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function IssueDeleteDialog({ issue, taskCount, onClose, onDeleted }: Props) {
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (issue) {
      setMode('detach');
      setBusy(false);
    }
  }, [issue]);

  if (!issue) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/issues/${issue.id}?cascade=${mode}`, {
        method: 'DELETE',
      });
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!issue} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ISSUE 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {taskCount > 0 ? (
            <>
              <p className="text-sm">
                <span className="font-medium">&ldquo;{issue.name}&rdquo;</span>의 자식 TASK{' '}
                <strong>{taskCount}개</strong>를 어떻게 처리할까요?
              </p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="cascade"
                  className="mt-0.5"
                  checked={mode === 'detach'}
                  onChange={() => setMode('detach')}
                />
                <span>
                  <span className="font-medium">독립 TASK로 분리해서 보존</span>
                  <span className="block text-xs text-muted-foreground">
                    기본값. 자식 TASK는 인박스에 그대로 남고 ISSUE만 삭제됩니다.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="cascade"
                  className="mt-0.5"
                  checked={mode === 'delete'}
                  onChange={() => setMode('delete')}
                />
                <span>
                  <span className="font-medium">함께 휴지통으로 이동</span>
                  <span className="block text-xs text-muted-foreground">
                    ISSUE와 모든 자식 TASK·sub-TASK가 휴지통으로 이동합니다.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <p className="text-sm">
              <span className="font-medium">&ldquo;{issue.name}&rdquo;</span>를 삭제합니다.
              자식 TASK가 없습니다.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
