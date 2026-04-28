import { toast } from 'sonner';
import { apiFetch } from './api';
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

/** Idempotent — used by Today-page creation flows to auto-include a freshly
 * captured task in today's list without requiring an extra Sun-icon click. */
export function addTodayTask(id: string) {
  const ids = getTodayTaskIds();
  if (ids.has(id)) return;
  ids.add(id);
  saveTodayTaskIds(ids);
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

/** Next undone sibling under the same parent (issue_id + parent_task_id), by position. */
export function findNextSiblingTask(current: Task, allTasks: Task[]): Task | null {
  const candidates = allTasks
    .filter(t =>
      !t.is_deleted &&
      t.id !== current.id &&
      t.issue_id === current.issue_id &&
      t.parent_task_id === current.parent_task_id &&
      t.status !== '완료' &&
      t.position > current.position,
    )
    .sort((a, b) => a.position - b.position);
  return candidates[0] ?? null;
}

/**
 * Called whenever a TASK transitions to 완료. If it was explicitly in 오늘
 * AND has an undone sibling that is NOT yet in 오늘, surface a toast offering
 * to pull that next sibling into today.
 */
export async function promptNextInTodayIfNeeded(completed: Task) {
  if (typeof window === 'undefined') return;
  // Only meaningful for tasks that have siblings (under an ISSUE or under a parent TASK).
  if (!completed.issue_id && !completed.parent_task_id) return;
  const explicit = getTodayTaskIds();
  if (!explicit.has(completed.id)) return; // only fire for explicitly-added today items
  let allTasks: Task[];
  try {
    allTasks = await apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true });
  } catch {
    return;
  }
  const next = findNextSiblingTask(completed, allTasks);
  if (!next) return;
  // If the next sibling is already in today (explicit or via descendant pull), skip.
  if (getEffectiveTodayTaskIds(explicit, allTasks).has(next.id)) return;
  toast(`✓ 완료. 다음: "${next.title}"`, {
    description: '이 TASK도 오늘에 추가할까요?',
    duration: 8000,
    action: {
      label: '오늘에 추가',
      onClick: () => {
        const ids = getTodayTaskIds();
        ids.add(next.id);
        saveTodayTaskIds(ids);
      },
    },
  });
}
