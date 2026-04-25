'use client';

import { useMemo } from 'react';
import { Issue, Task } from '@/lib/types';
import { buildTree, filterIncomplete, countSubtasks } from '@/lib/hierarchy';
import { lockedSiblings } from '@/lib/lock-state';
import { IssueRow } from '@/components/issues/issue-row';
import { TaskBranch, TaskBranchHandlers } from '@/components/tasks/task-branch';

interface Props {
  issues: Issue[];
  tasks: Task[];
  showCompleted: boolean;
  taskHandlers: TaskBranchHandlers;
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
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
