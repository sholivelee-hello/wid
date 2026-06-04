import { toast } from 'sonner';
import { apiFetch } from './api';
import { isTaskDone, type Task } from './types';

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
 * Drop a task (and its descendants) from the explicit Today set. Called on
 * 보류(pend): a pended task is "치워둔 일", so it must leave 오늘 too —
 * otherwise unpend(복귀) returns it but /inbox keeps hiding it (it's still in
 * the today set), so it looks like 복귀 did nothing. Mirrors pend's server-side
 * propagation to direct children (3-level invariant ⇒ descendants = children).
 * No-op (skips save/event) if nothing changed. Pure aside from localStorage.
 */
export function removeTodayTaskWithDescendants(rootId: string, tasks: Task[]) {
  const ids = getTodayTaskIds();
  if (ids.size === 0) return;
  const toRemove = new Set<string>([rootId]);
  for (const t of tasks) {
    if (t.parent_task_id && toRemove.has(t.parent_task_id)) toRemove.add(t.id);
  }
  let changed = false;
  for (const id of toRemove) {
    if (ids.delete(id)) changed = true;
  }
  if (changed) saveTodayTaskIds(ids);
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Drop explicit ids whose task was completed *before* today (local date), or
 * whose task no longer exists. Tasks completed today stay so the user still
 * sees their 오늘 완료 tally. Pure — caller persists if the set changed.
 *
 * Why: explicit set lives in localStorage and never auto-clears; without this,
 * yesterday's done tasks keep showing up in /today's 완료 section forever.
 */
export function pruneStaleTodayIds(
  explicitIds: Set<string>,
  tasks: Task[],
): Set<string> {
  if (explicitIds.size === 0) return explicitIds;
  const todayStr = localDateStr(new Date());
  const byId = new Map(tasks.map(t => [t.id, t] as const));
  const out = new Set<string>();
  let changed = false;
  for (const id of explicitIds) {
    const t = byId.get(id);
    if (!t || t.is_deleted) { changed = true; continue; }
    if (isTaskDone(t.status) && t.completed_at) {
      const completedStr = localDateStr(new Date(t.completed_at));
      if (completedStr < todayStr) { changed = true; continue; }
    }
    out.add(id);
  }
  return changed ? out : explicitIds;
}

/**
 * Deadline-based auto-include: a task whose due date is today or past, and is
 * not completed / pending / deleted, is implicitly part of today even if the
 * user never tapped its Sun icon. Returns the matching task ids.
 *
 * Why a separate layer (not merged into the explicit set): the explicit set is
 * the single source of truth persisted in localStorage. Folding deadline tasks
 * into it would (a) make the auto-inclusion sticky after the deadline passes or
 * the task completes, and (b) blur "did the user choose this?". Keeping it
 * derived means it always reflects current task state and never needs cleanup.
 */
export function getDeadlineTodayTaskIds(
  tasks: Task[],
  todayStr: string,
): Set<string> {
  const out = new Set<string>();
  for (const t of tasks) {
    if (t.is_deleted) continue;
    if (t.pending_at) continue;
    if (isTaskDone(t.status)) continue;
    if (!t.deadline) continue;
    // deadline is ISO; compare the date portion only. 오늘이거나 지난 것.
    if (t.deadline.slice(0, 10) <= todayStr) out.add(t.id);
  }
  return out;
}

/**
 * Completed-today auto-include: a task whose `completed_at` falls on today
 * (local date) shows up in 오늘 even if it was never added to the explicit set
 * — e.g. completed straight from /inbox. Mirrors the user's mental model of
 * "what I finished today" so the 완료 section reflects all of today's wins.
 *
 * 완료만 — '취소'(cancel)는 끌어오지 않는다. The mental model is 오늘 완료한 일의
 * 회고, not 처리한 일 전부. `isCompleted` checks the 완료 status specifically
 * (not isTaskDone, which folds in 취소).
 *
 * Like deadline-auto, this is a derived layer — never written into the explicit
 * localStorage set. So reverting a completion (되돌리기) drops it from 오늘 again,
 * and /inbox hide-rules (which look at the explicit set only) are unaffected.
 *
 * "Today" is resolved via `localDateStr(new Date())` (local timezone) rather
 * than a passed-in string — matching `countCompletedToday` / `pruneStaleTodayIds`
 * — so completion (`completed_at`, local) is compared local-vs-local. The page's
 * own `todayStr` is UTC-derived, which would mis-bucket completions late at night
 * in eastern timezones; deriving local here keeps the comparison correct.
 */
export function getCompletedTodayTaskIds(tasks: Task[]): Set<string> {
  const todayStr = localDateStr(new Date());
  const out = new Set<string>();
  for (const t of tasks) {
    if (t.is_deleted) continue;
    if (t.status !== '완료') continue;
    if (!t.completed_at) continue;
    if (localDateStr(new Date(t.completed_at)) === todayStr) out.add(t.id);
  }
  return out;
}

/**
 * Effective Today set = explicit ids ∪ all descendants (children, grandchildren…)
 * of those explicit ids. Adding a parent TASK to Today implicitly pulls its
 * sub-TASKs (and their sub-TASKs) along.
 *
 * When `todayStr` is provided, deadline-auto tasks (due today or past) and
 * completed-today tasks (completed_at == today) are folded in as additional
 * roots and their descendants pulled along too — so an overdue task, or one
 * completed straight from /inbox, shows up in 오늘 without an explicit Sun tap.
 */
export function getEffectiveTodayTaskIds(
  explicitIds: Set<string>,
  tasks: Task[],
  todayStr?: string,
): Set<string> {
  const seeds = new Set(explicitIds);
  if (todayStr) {
    for (const id of getDeadlineTodayTaskIds(tasks, todayStr)) seeds.add(id);
    for (const id of getCompletedTodayTaskIds(tasks)) seeds.add(id);
  }
  if (seeds.size === 0) return new Set();
  const childrenByParent = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.is_deleted) continue;
    if (!t.parent_task_id) continue;
    const arr = childrenByParent.get(t.parent_task_id) ?? [];
    arr.push(t.id);
    childrenByParent.set(t.parent_task_id, arr);
  }
  const out = new Set(seeds);
  const queue = [...seeds];
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
      !isTaskDone(t.status) &&
      t.position > current.position,
    )
    .sort((a, b) => a.position - b.position);
  return candidates[0] ?? null;
}

/** Count of tasks completed *today* (local date), by completed_at. Used for
 *  the "오늘 N개 완료" tally on completion. Simpler + consistent across pages
 *  than an effective-today-membership count (spec 결정 5). */
export function countCompletedToday(tasks: Task[]): number {
  const todayStr = localDateStr(new Date());
  let n = 0;
  for (const t of tasks) {
    if (t.is_deleted) continue;
    if (!isTaskDone(t.status)) continue;
    if (!t.completed_at) continue;
    if (localDateStr(new Date(t.completed_at)) === todayStr) n += 1;
  }
  return n;
}

/**
 * Called whenever a TASK transitions to 완료. Fetches the current task list
 * once, then surfaces a single completion toast:
 *  - if an undone sibling exists that isn't yet in 오늘, the prompt-next toast
 *    (with the 오늘 누적 tally in its description),
 *  - otherwise a plain "오늘 N개 완료" tally toast.
 * One fetch, one toast — never two stacked toasts on a single completion.
 */
export async function promptNextInTodayIfNeeded(completed: Task) {
  if (typeof window === 'undefined') return;
  let allTasks: Task[];
  try {
    allTasks = await apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true });
  } catch {
    return;
  }
  const doneToday = countCompletedToday(allTasks);
  const tally = doneToday > 0 ? `오늘 ${doneToday}개 완료` : '';

  // prompt-next는 explicit하게 오늘에 든 task + sibling이 의미 있는 경우에만.
  const explicit = getTodayTaskIds();
  const siblingMeaningful = !!(completed.issue_id || completed.parent_task_id);
  if (siblingMeaningful && explicit.has(completed.id)) {
    const next = findNextSiblingTask(completed, allTasks);
    // 다음 sibling이 아직 오늘(effective)에 없을 때만 권유.
    if (next && !getEffectiveTodayTaskIds(explicit, allTasks).has(next.id)) {
      toast(`✓ 완료. 다음: "${next.title}"`, {
        description: tally ? `${tally} · 이 TASK도 오늘에 추가할까요?` : '이 TASK도 오늘에 추가할까요?',
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
      return;
    }
  }

  // sibling 권유가 없으면 누적 토스트만.
  if (tally) toast(`✓ ${tally}`);
}
