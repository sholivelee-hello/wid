'use client';

import { useEffect, useState, useCallback } from 'react';
import { Issue, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, PauseCircle, FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * 보류함 뷰 — 기존 /pending 페이지의 목록·복귀(unpend) 동작을 컴포넌트로 추출.
 * /inbox?view=pending 칩과 (호환용) /pending redirect 양쪽에서 재사용.
 * 보류 invariant(docs/architecture/pending.md)는 그대로 — 표시 위치만 이동.
 */
export function PendingView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [taskData, issueData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks?pending=true'),
        apiFetch<Issue[]>('/api/issues?pending=true'),
      ]);
      setTasks(taskData);
      setIssues(issueData);
    } catch {
      // apiFetch가 에러를 표면화함
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUnpendTask = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}/unpend`, { method: 'POST' });
      toast.success('인박스로 복귀했어요');
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchAll();
    } catch {
      // 실패 시 목록 유지 — 재시도 가능
    }
  };

  const handleUnpendIssue = async (issue: Issue) => {
    try {
      await apiFetch(`/api/issues/${issue.id}/unpend`, { method: 'POST' });
      toast.success(`"${issue.name}" 전체가 인박스로 복귀했어요`);
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchAll();
    } catch {
      // 실패 시 목록 유지 — 재시도 가능
    }
  };

  if (loading) return <TaskListSkeleton />;

  // ISSUE 묶음으로 보류된 것과 개별 보류를 분리해서 표시.
  // sub-task는 issue_id가 null일 수 있어 부모를 따라 ISSUE 묶음에 귀속시킨다.
  const pendingIssueIds = new Set(issues.map(i => i.id));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const belongsToPendingIssue = (t: Task): boolean => {
    if (t.issue_id && pendingIssueIds.has(t.issue_id)) return true;
    const parent = t.parent_task_id ? taskById.get(t.parent_task_id) : undefined;
    return !!(parent?.issue_id && pendingIssueIds.has(parent.issue_id));
  };
  const issueTaskCount = (issueId: string) =>
    tasks.filter(t =>
      t.issue_id === issueId ||
      (t.parent_task_id && taskById.get(t.parent_task_id)?.issue_id === issueId),
    ).length;
  const individualTasks = tasks.filter(t => !belongsToPendingIssue(t));
  // 개별 보류 중 sub-task는 부모가 같이 보류된 경우 부모 카드로 묶이므로 숨김.
  const individualTop = individualTasks.filter(
    t => !t.parent_task_id || !individualTasks.some(p => p.id === t.parent_task_id),
  );
  const childrenOf = (id: string) =>
    individualTasks.filter(t => t.parent_task_id === id);

  const isEmpty = issues.length === 0 && tasks.length === 0;

  return (
    <div className="space-y-3">
      {!isEmpty && (
        <p className="text-xs text-muted-foreground">
          {issues.length > 0 && `ISSUE ${issues.length}개`}
          {issues.length > 0 && individualTop.length > 0 && ' · '}
          {individualTop.length > 0 && `task ${individualTop.length}개`}
          {' '}보류 중 · 복귀하면 원래 자리로 돌아가요.
        </p>
      )}

      {isEmpty && (
        <EmptyState
          icon={PauseCircle}
          title="보류함이 비어있어요"
          description="인박스에서 task나 ISSUE의 ⋯ 메뉴 → 보류로 치워둘 수 있어요"
        />
      )}

      {issues.map(issue => (
        <Card key={issue.id} className="shadow-none">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden />
                <Badge variant="outline" className="text-[10px] font-semibold tracking-wide px-1.5 h-4 rounded-sm bg-primary/10 text-primary border-primary/20">
                  ISSUE
                </Badge>
              </div>
              <p className="font-medium truncate">{issue.name}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                task {issueTaskCount(issue.id)}개
                {issue.pending_at && ` · ${formatDate(issue.pending_at, 'M월 d일')} 보류`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleUnpendIssue(issue)} className="shrink-0">
              <RotateCcw className="h-4 w-4 mr-1" />
              통째로 복귀
            </Button>
          </CardContent>
        </Card>
      ))}

      {individualTop.map(task => {
        const subs = childrenOf(task.id);
        return (
          <Card key={task.id} className="shadow-none">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{task.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {subs.length > 0 && `하위 ${subs.length}개 · `}
                  {task.pending_at && `${formatDate(task.pending_at, 'M월 d일')} 보류`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnpendTask(task.id)} className="shrink-0">
                <RotateCcw className="h-4 w-4 mr-1" />
                복귀
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
