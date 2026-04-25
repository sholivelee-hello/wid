'use client';

import { useEffect, useState, useCallback, useReducer } from 'react';
import { CustomStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_STATUSES } from '@/lib/constants';
import { getStatusColor, setStatusColorOverride } from '@/lib/status-colors';
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { useHiddenStatuses, hideDefaultStatus } from '@/lib/hidden-statuses';
import { useDefaultStatusRenames, setDefaultStatusRename } from '@/lib/status-renames';

type StatusItem = {
  id: string;
  displayName: string;
  color: string;
  kind: 'default' | 'custom';
};

export function CustomStatusManager() {
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [editItem, setEditItem] = useState<StatusItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [deleteTarget, setDeleteTarget] = useState<StatusItem | null>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const hiddenStatuses = useHiddenStatuses();
  const defaultRenames = useDefaultStatusRenames();

  const fetchStatuses = useCallback(async () => {
    try {
      const data = await apiFetch<CustomStatus[]>('/api/custom-statuses');
      setCustomStatuses(data);
    } catch {}
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  useEffect(() => {
    const update = () => forceUpdate();
    window.addEventListener('status-colors-changed', update);
    window.addEventListener('status-renames-changed', update);
    return () => {
      window.removeEventListener('status-colors-changed', update);
      window.removeEventListener('status-renames-changed', update);
    };
  }, []);

  const allStatuses: StatusItem[] = [
    ...DEFAULT_STATUSES
      .filter(s => !hiddenStatuses.has(s))
      .map(s => {
        const displayName = defaultRenames[s] ?? s;
        return { id: s, displayName, color: getStatusColor(displayName), kind: 'default' as const };
      }),
    ...customStatuses.map(s => ({
      id: s.id, displayName: s.name, color: s.color, kind: 'custom' as const,
    })),
  ];

  const startEdit = (item: StatusItem) => {
    setEditItem(item);
    setEditName(item.displayName);
    setEditColor(item.color);
  };

  const cancelEdit = () => setEditItem(null);

  const saveEdit = async () => {
    if (!editItem || !editName.trim()) return;
    const nameChanged = editName.trim() !== editItem.displayName;
    const colorChanged = editColor !== editItem.color;

    if (editItem.kind === 'default') {
      if (nameChanged) {
        try {
          await apiFetch('/api/statuses/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: editItem.displayName, to: editName.trim() }),
          });
        } catch {}
        setDefaultStatusRename(editItem.id, editName.trim());
        setStatusColorOverride(editName.trim(), editColor);
      } else if (colorChanged) {
        setStatusColorOverride(editItem.displayName, editColor);
      }
      setEditItem(null);
    } else {
      try {
        await apiFetch(`/api/custom-statuses/${editItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), color: editColor }),
        });
        if (nameChanged) {
          try {
            await apiFetch('/api/statuses/rename', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: editItem.displayName, to: editName.trim() }),
            });
          } catch {}
        }
        setEditItem(null);
        fetchStatuses();
      } catch {}
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch('/api/custom-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      setNewName('');
      setNewColor('#6B7280');
      fetchStatuses();
    } catch {}
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'default') {
      hideDefaultStatus(deleteTarget.id);
    } else {
      try {
        await apiFetch(`/api/custom-statuses/${deleteTarget.id}`, { method: 'DELETE' });
        fetchStatuses();
      } catch {}
    }
    setDeleteTarget(null);
  };

  return (
    <Card>
      <CardHeader><CardTitle>상태 관리</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-0.5">
          {allStatuses.map(item => {
            const isEditing = editItem?.id === item.id && editItem?.kind === item.kind;

            if (isEditing) {
              return (
                <div key={item.id + item.kind} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/30">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-36 h-7 text-sm px-2"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-7 rounded cursor-pointer border border-border p-0.5"
                    title="색상 선택"
                  />
                  <button onClick={saveEdit} className="p-1 rounded hover:bg-muted text-primary" aria-label="저장">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="취소">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div key={item.id + item.kind} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <span
                  className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${item.color}25`, color: item.color }}
                >
                  {item.displayName}
                </span>
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1.5 rounded hover:bg-muted"
                    aria-label="편집"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-1.5 rounded hover:bg-muted text-destructive/60 hover:text-destructive"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <Input
            placeholder="새 상태 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border p-0.5"
            title="색상 선택"
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />추가
          </Button>
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="상태 삭제"
          description="이 상태를 삭제합니다. 이미 이 상태인 task에는 영향이 없습니다."
          confirmLabel="삭제"
          onConfirm={confirmDelete}
        />
      </CardContent>
    </Card>
  );
}
