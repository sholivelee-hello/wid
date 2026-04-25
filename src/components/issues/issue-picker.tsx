'use client';

import { useEffect, useState } from 'react';
import { Issue } from '@/lib/types';
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
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    apiFetch<Issue[]>('/api/issues').then(setIssues).catch(() => {});
  }, [open]);

  const filtered = issues.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
  const trimmed = q.trim();
  const exactMatch = trimmed && filtered.some(i => i.name === trimmed);

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
          {filtered.length === 0 && !trimmed && (
            <p className="text-xs text-muted-foreground py-3 text-center">
              아직 ISSUE가 없습니다. 위에 이름을 입력하면 새로 만들 수 있어요.
            </p>
          )}
          {filtered.map(i => {
            const isCurrent = i.id === currentIssueId;
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
                )}
              >
                <span className="inline-flex items-center justify-center text-[9px] font-semibold tracking-wide px-1.5 h-4 rounded-sm bg-primary/10 text-primary flex-shrink-0">
                  ISSUE
                </span>
                <span className="text-sm flex-1 truncate">{i.name}</span>
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
      </DialogContent>
    </Dialog>
  );
}
