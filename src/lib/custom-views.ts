export interface CustomTaskView {
  id: string;
  name: string;
  statuses: string[];    // empty = all statuses
  priorities: string[];  // empty = all priorities
  sortBy: 'priority' | 'deadline' | 'created_at';
}

const KEYS = {
  inbox: 'wid-inbox-views',
  today: 'wid-today-views',
};
const INBOX_FILTER_KEY = 'wid-inbox-filter';

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

export function makeViewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
