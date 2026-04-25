import { Issue, Task } from './types';

export interface IssueNode {
  issue: Issue;
  tasks: TaskNode[];
}
export interface TaskNode {
  task: Task;
  children: TaskNode[];
}

export interface Tree {
  issues: IssueNode[];
  independents: TaskNode[];
}

export function buildTree(issues: Issue[], tasks: Task[]): Tree {
  const live = tasks.filter(t => !t.is_deleted);
  const byParent = new Map<string, Task[]>();
  for (const t of live) {
    if (t.parent_task_id) {
      const arr = byParent.get(t.parent_task_id) ?? [];
      arr.push(t);
      byParent.set(t.parent_task_id, arr);
    }
  }
  const sortPos = (a: Task, b: Task) => a.position - b.position;
  const buildNode = (t: Task): TaskNode => ({
    task: t,
    children: (byParent.get(t.id) ?? []).sort(sortPos).map(buildNode),
  });

  const tasksByIssue = new Map<string, Task[]>();
  const independents: TaskNode[] = [];
  for (const t of live) {
    if (t.parent_task_id) continue;
    if (t.issue_id) {
      const arr = tasksByIssue.get(t.issue_id) ?? [];
      arr.push(t);
      tasksByIssue.set(t.issue_id, arr);
    } else {
      independents.push(buildNode(t));
    }
  }
  independents.sort((a, b) => a.task.position - b.task.position);

  const issueNodes: IssueNode[] = issues
    .filter(i => !i.is_deleted)
    .sort((a, b) => a.position - b.position)
    .map(issue => ({
      issue,
      tasks: (tasksByIssue.get(issue.id) ?? []).sort(sortPos).map(buildNode),
    }));

  return { issues: issueNodes, independents };
}

export function hasIncomplete(node: TaskNode): boolean {
  if (node.task.status !== '완료') return true;
  return node.children.some(hasIncomplete);
}

export function filterIncomplete(tree: Tree): Tree {
  const issueNodesPruned = tree.issues
    .map(i => ({ ...i, tasks: i.tasks.filter(hasIncomplete) }))
    .filter(i => i.tasks.length > 0);
  const indPruned = tree.independents.filter(hasIncomplete);
  return { issues: issueNodesPruned, independents: indPruned };
}

export function countSubtasks(nodes: TaskNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += n.children.length;
    total += countSubtasks(n.children);
  }
  return total;
}
