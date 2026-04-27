'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES, STATUS_COLORS } from '@/lib/constants';
import { TASK_STATUSES } from '@/lib/types';
import { makeViewId, type CustomTaskView } from '@/lib/custom-views';
import { cn } from '@/lib/utils';

interface ViewEditFormProps {
  initial?: CustomTaskView;
  onSave: (view: CustomTaskView) => void;
  onCancel: () => void;
}

export function ViewEditForm({ initial, onSave, onCancel }: ViewEditFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initial?.statuses ?? []);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(initial?.priorities ?? []);
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created_at'>(initial?.sortBy ?? 'priority');

  const toggleStatus = (original: string) =>
    setSelectedStatuses(prev =>
      prev.includes(original) ? prev.filter(x => x !== original) : [...prev, original]
    );

  const togglePriority = (p: string) =>
    setSelectedPriorities(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? makeViewId(),
      name: name.trim(),
      statuses: selectedStatuses,
      priorities: selectedPriorities,
      sortBy,
    });
  };

  const priorityColors: Record<string, string> = {
    '긴급': '#EF4444', '높음': '#F59E0B', '보통': '#6366F1', '낮음': '#9CA3AF',
  };

  return (
    <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-card/50">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="뷰 이름..."
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        className="text-sm"
      />

      {/* Status filter */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">상태 필터 (비워두면 전체)</p>
        <div className="flex flex-wrap gap-1.5">
          {TASK_STATUSES.map((s) => {
            const color = STATUS_COLORS[s];
            const active = selectedStatuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  'text-[11px] px-2.5 py-0.5 rounded-full border transition-all',
                  active ? 'font-medium' : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
                style={active ? { backgroundColor: `${color}20`, color, borderColor: color } : {}}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority filter */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">우선순위 필터 (비워두면 전체)</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map(p => {
            const color = priorityColors[p] ?? '#6B7280';
            const active = selectedPriorities.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                className={cn(
                  'text-[11px] px-2.5 py-0.5 rounded-full border transition-all',
                  active ? 'font-medium' : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
                style={active ? { backgroundColor: `${color}20`, color, borderColor: color } : {}}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-muted-foreground shrink-0">정렬:</p>
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-7 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">우선순위</SelectItem>
            <SelectItem value="deadline">마감일</SelectItem>
            <SelectItem value="created_at">생성일</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
          {initial ? '수정' : '뷰 추가'}
        </Button>
      </div>
    </div>
  );
}
