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

export default function TrashPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}/restore`, { method: 'POST' });
      fetchTasks();
    } catch {
      // error already toasted by apiFetch
    }
  };

  const openRestoreConfirm = (id: string) => {
    setRestoreId(id);
    setConfirmOpen(true);
  };

  const confirmRestore = () => {
    if (restoreId) {
      handleRestore(restoreId);
      setRestoreId(null);
    }
  };

  if (loading) return <TaskListSkeleton />;

  return (
    <div className="space-y-3">
      {tasks.length === 0 && <EmptyState icon={Trash2} title="휴지통이 비어있습니다" description="삭제된 task가 여기에 표시됩니다" />}
      {tasks.map((task) => (
        <Card key={task.id} className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{task.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{task.priority}</Badge>
                <Badge variant="outline">{task.status}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openRestoreConfirm(task.id)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              복구
            </Button>
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="task 복구"
        description="이 task를 복구하시겠습니까?"
        confirmLabel="복구"
        onConfirm={confirmRestore}
        variant="default"
      />
    </div>
  );
}
