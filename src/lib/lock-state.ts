import { TaskNode } from './hierarchy';
import { SortMode, isTaskDone } from './types';

export function lockedSiblings(siblings: TaskNode[], sortMode: SortMode): Set<string> {
  if (sortMode !== 'sequential') return new Set();
  const locked = new Set<string>();
  let pastFirstIncomplete = false;
  for (const node of siblings) {
    if (pastFirstIncomplete) locked.add(node.task.id);
    if (!isTaskDone(node.task.status)) pastFirstIncomplete = true;
  }
  return locked;
}

export function completionBlocked(node: TaskNode): boolean {
  return node.children.some(c => !isTaskDone(c.task.status));
}

export function incompleteChildCount(node: TaskNode): number {
  return node.children.filter(c => !isTaskDone(c.task.status)).length;
}
