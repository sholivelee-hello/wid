'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Task } from '@/lib/types';
import { TaskForm } from '@/components/tasks/task-form';
import { Button } from '@/components/ui/button';
import { TaskDetailSkeleton } from '@/components/loading/page-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { Trash2, AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [taskData, statusData] = await Promise.all([
        apiFetch<Task>(`/api/tasks/${id}`),
        apiFetch<{ name: string }[]>('/api/custom-statuses'),
      ]);
      setTask(taskData);
      setCustomStatuses(statusData.map((s) => s.name));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      router.push('/');
    } catch {
      // error already toasted by apiFetch
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <TaskDetailSkeleton />;
  if (error || !task) return <EmptyState icon={AlertCircle} title="task를 불러올 수 없습니다" description="네트워크 상태를 확인하고 다시 시도해주세요." />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-foreground transition-colors">인박스</Link>
        <span>/</span>
        <span className="text-foreground">{task.title}</span>
      </div>
      {task.slack_url && (
        <a href={task.slack_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          Slack 메시지 보기
        </a>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="task 삭제"
        description="이 task를 휴지통으로 이동합니다. 계속하시겠습니까?"
        confirmLabel="삭제"
        onConfirm={handleDelete}
      />

      <TaskForm task={task} customStatuses={customStatuses} />

      <div className="pt-4 border-t">
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" />
          task 삭제
        </Button>
      </div>
    </div>
  );
}
