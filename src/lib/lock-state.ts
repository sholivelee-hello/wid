import { TaskNode } from './hierarchy';
import { SortMode } from './types';

export function lockedSiblings(siblings: TaskNode[], sortMode: SortMode): Set<string> {
  if (sortMode !== 'sequential') return new Set();
  const locked = new Set<string>();
  let pastFirstIncomplete = false;
  for (const node of siblings) {
    if (pastFirstIncomplete) locked.add(node.task.id);
    if (node.task.status !== '완료') pastFirstIncomplete = true;
  }
  return locked;
}

export function completionBlocked(node: TaskNode): boolean {
  return node.children.some(c => c.task.status !== '완료');
}

export function incompleteChildCount(node: TaskNode): number {
  return node.children.filter(c => c.task.status !== '완료').length;
}
