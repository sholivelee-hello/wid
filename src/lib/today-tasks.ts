import type { Task } from './types';

const KEY = 'wid-today-task-ids';

export function getTodayTaskIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function saveTodayTaskIds(ids: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent('today-tasks-changed'));
}

export function toggleTodayTask(id: string): boolean {
  const ids = getTodayTaskIds();
  const wasIn = ids.has(id);
  if (wasIn) ids.delete(id); else ids.add(id);
  saveTodayTaskIds(ids);
  return !wasIn; // true = 추가됨
}

/**
 * Effective Today set = explicit ids ∪ all descendants (children, grandchildren…)
 * of those explicit ids. Adding a parent TASK to Today implicitly pulls its
 * sub-TASKs (and their sub-TASKs) along.
 */
export function getEffectiveTodayTaskIds(
  explicitIds: Set<string>,
  tasks: Task[],
): Set<string> {
  if (explicitIds.size === 0) return new Set();
  const childrenByParent = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.is_deleted) continue;
    if (!t.parent_task_id) continue;
    const arr = childrenByParent.get(t.parent_task_id) ?? [];
    arr.push(t.id);
    childrenByParent.set(t.parent_task_id, arr);
  }
  const out = new Set(explicitIds);
  const queue = [...explicitIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids = childrenByParent.get(id);
    if (!kids) continue;
    for (const kid of kids) {
      if (!out.has(kid)) {
        out.add(kid);
        queue.push(kid);
      }
    }
  }
  return out;
}
