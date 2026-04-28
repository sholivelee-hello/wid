'use client';

import { useEffect, useState, useCallback } from 'react';
import { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Confirm =
  | { kind: 'restore'; id: string }
  | { kind: 'purge-one'; id: string; title: string }
  | { kind: 'purge-all' };

export default function TrashPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Confirm | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch<Task[]>('/api/tasks?deleted=true');
      setTasks(data);
    } catch {
      // error already toasted by apiFetch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}/restore`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchTasks();
    } catch {
      // toasted by apiFetch
    }
  };

  const handlePurgeOne = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}/purge`, { method: 'DELETE' });
      toast.success('영구 삭제 완료');
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchTasks();
    } catch {
      // toasted by apiFetch
    }
  };

  const handlePurgeAll = async () => {
    try {
      const res = await apiFetch<{ deleted: number }>('/api/tasks/purge', {
        method: 'DELETE',
      });
      toast.success(`휴지통 비움 (${res.deleted ?? 0}개 영구 삭제)`);
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchTasks();
    } catch {
      // toasted by apiFetch
    }
  };

  const onConfirm = () => {
    if (!pending) return;
    if (pending.kind === 'restore') handleRestore(pending.id);
    else if (pending.kind === 'purge-one') handlePurgeOne(pending.id);
    else handlePurgeAll();
    setPending(null);
  };

  if (loading) return <TaskListSkeleton />;

  return (
    <div className="space-y-3">
      {tasks.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tasks.length}개 항목 · 영구 삭제하면 복구할 수 없어요.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setPending({ kind: 'purge-all' })}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            휴지통 비우기
          </Button>
        </div>
      )}

      {tasks.length === 0 && (
        <EmptyState
          icon={Trash2}
          title="휴지통이 비어있습니다"
          description="삭제된 task가 여기에 표시됩니다"
        />
      )}

      {tasks.map((task) => {
        const isSub = !!task.parent_task_id;
        // 부모는 휴지통 / 활성 어디에 있든 보여주기 위해 전체 task 리스트에서
        // 찾는다. 휴지통 페이지는 deleted=true 만 받아오므로 부모가 활성이면
        // 여기 list에는 없다. 그 경우엔 그냥 "sub-TASK" 배지만.
        const parent = isSub ? tasks.find(t => t.id === task.parent_task_id) : null;
        return (
        <Card key={task.id} className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-semibold tracking-wide px-1.5 h-4 rounded-sm',
                    isSub
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isSub ? 'sub-TASK' : 'TASK'}
                </Badge>
                {parent && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    ↳ {parent.title}
                  </span>
                )}
              </div>
              <p className="font-medium truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{task.priority}</Badge>
                <Badge variant="outline">{task.status}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPending({ kind: 'restore', id: task.id })}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                복구
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  setPending({ kind: 'purge-one', id: task.id, title: task.title })
                }
              >
                <Trash2 className="h-4 w-4 mr-1" />
                영구 삭제
              </Button>
            </div>
          </CardContent>
        </Card>
        );
      })}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          pending?.kind === 'restore'
            ? 'task 복구'
            : pending?.kind === 'purge-all'
              ? '휴지통 비우기'
              : 'task 영구 삭제'
        }
        description={
          pending?.kind === 'restore'
            ? '이 task를 복구하시겠습니까?'
            : pending?.kind === 'purge-all'
              ? `휴지통의 모든 task(${tasks.length}개)와 그 하위 task를 데이터베이스에서 영구 삭제합니다. 복구할 수 없어요.`
              : `"${pending?.kind === 'purge-one' ? pending.title : ''}" 와 그 하위 task를 데이터베이스에서 영구 삭제합니다. 복구할 수 없어요.`
        }
        confirmLabel={pending?.kind === 'restore' ? '복구' : '영구 삭제'}
        variant={pending?.kind === 'restore' ? 'default' : 'destructive'}
        onConfirm={onConfirm}
      />
    </div>
  );
}
