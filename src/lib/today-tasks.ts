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
