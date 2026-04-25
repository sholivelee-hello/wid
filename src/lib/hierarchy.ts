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

export interface SearchResult {
  tree: Tree;
  forceOpenIssueIds: Set<string>;
  forceOpenTaskIds: Set<string>;
  matched: Set<string>;
}

function pruneNode(node: TaskNode, q: string, forceOpenTaskIds: Set<string>): TaskNode | null {
  const selfMatch = node.task.title.toLowerCase().includes(q);
  const prunedChildren = node.children
    .map(c => pruneNode(c, q, forceOpenTaskIds))
    .filter((c): c is TaskNode => c !== null);

  if (selfMatch) {
    // Show the entire descendant subtree intact.
    if (node.children.length > 0) forceOpenTaskIds.add(node.task.id);
    return { task: node.task, children: node.children };
  }
  if (prunedChildren.length > 0) {
    forceOpenTaskIds.add(node.task.id);
    return { task: node.task, children: prunedChildren };
  }
  return null;
}

export function filterBySearch(tree: Tree, query: string): SearchResult {
  const q = query.trim().toLowerCase();
  const forceOpenIssueIds = new Set<string>();
  const forceOpenTaskIds = new Set<string>();
  const matched = new Set<string>();

  if (!q) {
    return { tree, forceOpenIssueIds, forceOpenTaskIds, matched };
  }

  const collectMatched = (n: TaskNode) => {
    if (n.task.title.toLowerCase().includes(q)) matched.add(n.task.id);
    n.children.forEach(collectMatched);
  };

  const issuesPruned = tree.issues
    .map(({ issue, tasks }) => {
      tasks.forEach(collectMatched);
      const issueNameMatch = issue.name.toLowerCase().includes(q);
      const prunedTasks = issueNameMatch
        ? tasks
        : tasks
            .map(t => pruneNode(t, q, forceOpenTaskIds))
            .filter((t): t is TaskNode => t !== null);
      if (prunedTasks.length === 0 && !issueNameMatch) return null;
      forceOpenIssueIds.add(issue.id);
      return { issue, tasks: prunedTasks };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  tree.independents.forEach(collectMatched);
  const indPruned = tree.independents
    .map(t => pruneNode(t, q, forceOpenTaskIds))
    .filter((t): t is TaskNode => t !== null);

  return {
    tree: { issues: issuesPruned, independents: indPruned },
    forceOpenIssueIds,
    forceOpenTaskIds,
    matched,
  };
}
