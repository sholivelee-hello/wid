'use client';

import { useState } from 'react';
import { Issue, SortMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#94a3b8',
];

interface Props {
  initial?: Issue;
  onSave: (issue: Issue) => void;
  onCancel: () => void;
}

export function IssueForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [mode, setMode] = useState<SortMode>(initial?.sort_mode ?? 'checklist');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        color,
        deadline: deadline || null,
        sort_mode: mode,
      };
      const result = initial
        ? await apiFetch<Issue>(`/api/issues/${initial.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch<Issue>('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      onSave(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 p-3 rounded-xl border border-border/60 bg-card"
    >
      <Input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="ISSUE 이름"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">색상</span>
        {PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={cn(
              'h-5 w-5 rounded-full ring-offset-2 transition',
              c === color && 'ring-2 ring-foreground',
            )}
            style={{ backgroundColor: c }}
            aria-label={`색상 ${c}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">마감일</span>
        <Input
          type="date"
          value={deadline ?? ''}
          onChange={e => setDeadline(e.target.value)}
          className="max-w-[180px]"
        />
        {deadline && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDeadline('')}
          >
            지우기
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">정렬 모드</span>
        <Button
          type="button"
          size="sm"
          variant={mode === 'checklist' ? 'default' : 'outline'}
          onClick={() => setMode('checklist')}
        >
          체크리스트
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'sequential' ? 'default' : 'outline'}
          onClick={() => setMode('sequential')}
        >
          순차
        </Button>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button type="submit" disabled={!name.trim() || busy}>
          {initial ? '저장' : '생성'}
        </Button>
      </div>
    </form>
  );
}
