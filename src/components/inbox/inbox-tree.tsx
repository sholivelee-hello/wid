'use client';

import { useMemo } from 'react';
import { Issue, Task } from '@/lib/types';
import { buildTree, filterIncomplete, countSubtasks, TaskNode } from '@/lib/hierarchy';
import { lockedSiblings, completionBlocked, incompleteChildCount } from '@/lib/lock-state';
import { TaskCard } from '@/components/tasks/task-card';
import { IssueRow } from '@/components/issues/issue-row';
import { useCollapsed } from '@/lib/use-tree-collapsed';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskHandlers {
  onTimerChange: () => void;
  onStatusChange: (id: string, status: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}

interface Props {
  issues: Issue[];
  tasks: Task[];
  showCompleted: boolean;
  taskHandlers: TaskHandlers;
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
}

interface BranchProps extends TaskHandlers {
  node: TaskNode;
  depth: number;
  lockedIds: Set<string>;
}

function TaskBranch({
  node,
  depth,
  lockedIds,
  onTimerChange,
  onStatusChange,
  onComplete,
  onDelete,
  onSelect,
}: BranchProps) {
  const { collapsed, toggle } = useCollapsed('task', node.task.id, false);
  const blocked = completionBlocked(node);
  const locked = lockedIds.has(node.task.id);
  const childLocked = lockedSiblings(node.children, node.task.sort_mode);
  const blockedCount = incompleteChildCount(node);

  const handleComplete = blocked
    ? () => {/* blocked: no-op */}
    : onComplete;
  const handleStatusChange = blocked
    ? (id: string, status: string) => {
        if (status === '완료') return;
        onStatusChange(id, status);
      }
    : onStatusChange;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-start gap-1">
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? '하위 펼치기' : '하위 접기'}
            aria-expanded={!collapsed}
            className="mt-3 p-1 -m-1 rounded text-muted-foreground hover:bg-accent/50"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                collapsed && '-rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="mt-3 inline-block w-[22px]" aria-hidden />
        )}
        <div className={cn('flex-1 min-w-0', locked && 'opacity-60')}>
          <TaskCard
            task={node.task}
            onTimerChange={onTimerChange}
            onStatusChange={handleStatusChange}
            onComplete={handleComplete}
            onDelete={onDelete}
            onSelect={onSelect}
          />
          {blocked && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400 ml-3 mt-1">
              🔒 sub-TASK {blockedCount}개 미완료 — 완료할 수 없음
            </div>
          )}
          {locked && !blocked && (
            <div className="text-[10px] text-muted-foreground ml-3 mt-1">
              🔒 이전 task 대기 중
            </div>
          )}
        </div>
      </div>
      {!collapsed && node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map(child => (
            <TaskBranch
              key={child.task.id}
              node={child}
              depth={depth + 1}
              lockedIds={childLocked}
              onTimerChange={onTimerChange}
              onStatusChange={onStatusChange}
              onComplete={onComplete}
              onDelete={onDelete}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InboxTree({
  issues,
  tasks,
  showCompleted,
  taskHandlers,
  onEditIssue,
  onDeleteIssue,
}: Props) {
  const tree = useMemo(() => {
    const built = buildTree(issues, tasks);
    return showCompleted ? built : filterIncomplete(built);
  }, [issues, tasks, showCompleted]);

  if (tree.issues.length === 0 && tree.independents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {tree.issues.map(({ issue, tasks: nodes }) => {
        const total = nodes.length;
        const done = nodes.filter(n => n.task.status === '완료').length;
        const subCount = countSubtasks(nodes);
        const locked = lockedSiblings(nodes, issue.sort_mode);
        return (
          <IssueRow
            key={issue.id}
            issue={issue}
            taskCount={total}
            doneCount={done}
            subCount={subCount}
            onEdit={() => onEditIssue(issue)}
            onDelete={() => onDeleteIssue(issue)}
          >
            {nodes.map(n => (
              <TaskBranch
                key={n.task.id}
                node={n}
                depth={0}
                lockedIds={locked}
                {...taskHandlers}
              />
            ))}
          </IssueRow>
        );
      })}
      {tree.independents.length > 0 && (
        <div className="space-y-2">
          {tree.independents.map(n => (
            <TaskBranch
              key={n.task.id}
              node={n}
              depth={0}
              lockedIds={new Set<string>()}
              {...taskHandlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
