'use client';

import { useEffect, useState, useCallback } from 'react';
import { CustomStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_STATUSES, STATUS_COLORS, getContrastTextColor } from '@/lib/constants';
import { Trash2, Plus, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useHiddenStatuses, hideDefaultStatus, unhideDefaultStatus } from '@/lib/hidden-statuses';

export function CustomStatusManager() {
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const hiddenStatuses = useHiddenStatuses();
  const visibleDefaults = DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s));

  const fetchStatuses = useCallback(async () => {
    try {
      const data = await apiFetch<CustomStatus[]>('/api/custom-statuses');
      setStatuses(data);
    } catch {
      // error already toasted by apiFetch
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch('/api/custom-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      toast.success('상태가 추가되었습니다');
      setNewName('');
      setNewColor('#6B7280');
      fetchStatuses();
    } catch {
      // error already toasted by apiFetch
    }
  };

  const handleEdit = (s: CustomStatus) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await apiFetch(`/api/custom-statuses/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      toast.success('상태가 수정되었습니다');
      setEditingId(null);
      fetchStatuses();
    } catch {
      // error already toasted by apiFetch
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/custom-statuses/${id}`, { method: 'DELETE' });
      toast.success('상태가 삭제되었습니다');
      fetchStatuses();
    } catch {
      // error already toasted by apiFetch
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>상태 관리</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">기본 상태</p>
          <div className="flex flex-wrap gap-2">
            {visibleDefaults.map((s) => (
              <div key={s} className="inline-flex items-center gap-1">
                <Badge style={{ backgroundColor: STATUS_COLORS[s], color: getContrastTextColor(STATUS_COLORS[s] ?? '#6B7280') }}>{s}</Badge>
                <button
                  onClick={() => {
                    hideDefaultStatus(s);
                    toast.success(`"${s}" 상태를 숨겼습니다`);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="숨기기"
                  aria-label={`${s} 상태 숨기기`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
        {hiddenStatuses.size > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">숨긴 기본 상태</p>
            <div className="flex flex-wrap gap-2">
              {[...hiddenStatuses].map(name => (
                <button
                  key={name}
                  onClick={() => unhideDefaultStatus(name)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  {name} 복구
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground mb-2">커스텀 상태</p>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                {editingId === s.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-32 h-8" />
                    <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-12 h-8" />
                    <Button variant="ghost" size="sm" onClick={handleEditSave}><Check className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  </>
                ) : (
                  <>
                    <Badge style={{ backgroundColor: s.color, color: getContrastTextColor(s.color) }}>{s.name}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input
              placeholder="상태 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-40"
            />
            <Input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-16"
            />
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />추가
            </Button>
          </div>
        </div>
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="상태 삭제"
          description="이 커스텀 상태를 삭제합니다."
          confirmLabel="삭제"
          onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        />
      </CardContent>
    </Card>
  );
}
