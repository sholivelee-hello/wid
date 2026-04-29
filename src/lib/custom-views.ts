export type SortKey =
  | 'priority'
  | 'deadline'
  | 'created_at'
  | 'title'
  | 'requester'
  | 'source';

export const SORT_LABEL: Record<SortKey, string> = {
  created_at: '최근 추가',
  priority: '우선순위',
  deadline: '마감일',
  title: '이름',
  requester: '요청자',
  source: '출처',
};

const SORT_KEYS: SortKey[] = [
  'created_at',
  'priority',
  'deadline',
  'title',
  'requester',
  'source',
];

function isSortKey(v: string | null): v is SortKey {
  return v != null && (SORT_KEYS as string[]).includes(v);
}

export interface CustomTaskView {
  id: string;
  name: string;
  statuses: string[];    // empty = all statuses
  priorities: string[];  // empty = all priorities
  sortBy: SortKey;
}

const KEYS = {
  inbox: 'wid-inbox-views',
  today: 'wid-today-views',
};
const INBOX_FILTER_KEY = 'wid-inbox-filter';
const INBOX_SORT_KEY = 'wid-inbox-sort';

export function loadViews(page: 'inbox' | 'today'): CustomTaskView[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEYS[page]) ?? '[]');
  } catch {
    return [];
  }
}

export function saveViews(page: 'inbox' | 'today', views: CustomTaskView[]) {
  localStorage.setItem(KEYS[page], JSON.stringify(views));
}

export function loadInboxFilter(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(INBOX_FILTER_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveInboxFilter(statuses: string[]) {
  localStorage.setItem(INBOX_FILTER_KEY, JSON.stringify(statuses));
}

export function loadInboxSort(): SortKey {
  if (typeof window === 'undefined') return 'created_at';
  try {
    const raw = localStorage.getItem(INBOX_SORT_KEY);
    if (isSortKey(raw)) return raw;
  } catch {}
  return 'created_at';
}

export function saveInboxSort(v: SortKey) {
  localStorage.setItem(INBOX_SORT_KEY, v);
}

export function makeViewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
