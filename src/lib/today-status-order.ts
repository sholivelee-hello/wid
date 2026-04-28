/**
 * Persistent ordering of status groups on the Today page.
 *
 * 1인 사용자 앱이므로 그냥 localStorage에 저장. 신규 status가 코드에 추가되면
 * 저장 순서에 없는 status들은 기본 순서(TASK_STATUSES) 끝에 자연스레 추가됨.
 */
import { TASK_STATUSES, type TaskStatus } from './types';

const KEY = 'wid-today-status-order';
const EVENT = 'today-status-order-changed';

export function loadStatusOrder(): TaskStatus[] {
  if (typeof window === 'undefined') return [...TASK_STATUSES];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...TASK_STATUSES];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [...TASK_STATUSES];
    const known = new Set<string>(TASK_STATUSES);
    const filtered = saved.filter((s): s is TaskStatus => typeof s === 'string' && known.has(s));
    // Append any newly introduced statuses that the saved order doesn't know yet.
    const missing = (TASK_STATUSES as readonly TaskStatus[]).filter(s => !filtered.includes(s));
    return [...filtered, ...missing];
  } catch {
    return [...TASK_STATUSES];
  }
}

export function saveStatusOrder(order: TaskStatus[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(order));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const STATUS_ORDER_EVENT = EVENT;
