export type Priority = '긴급' | '높음' | '보통' | '낮음';
export type Source = 'manual' | 'notion' | 'slack';
export type SortMode = 'checklist' | 'sequential';

export const TASK_STATUSES = ['등록', '진행중', '대기중', '완료', '위임', '취소'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v);
}

export function normalizeStatus(s: unknown): TaskStatus {
  return isTaskStatus(s) ? s : '등록';
}

export interface Issue {
  id: string;
  name: string;
  deadline: string | null;        // ISO date string (YYYY-MM-DD)
  sort_mode: SortMode;
  position: number;
  notion_issue_id: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  source: Source;
  requester: string | null;
  requested_at: string | null;
  created_at: string;
  deadline: string | null;
  completed_at: string | null;
  notion_task_id: string | null;
  slack_url: string | null;
  notion_issue: string | null;
  slack_channel: string | null;
  slack_sender: string | null;
  delegate_to: string | null;
  follow_up_note: string | null;
  issue_id: string | null;
  parent_task_id: string | null;
  sort_mode: SortMode;
  position: number;
  is_deleted: boolean;
}

export interface NotionStatusMapping {
  id: string;
  notion_status: string;
  wid_status: string;
}

export interface GCalEvent {
  id: string;
  calendarId: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  meetLink?: string;
}

export interface CalendarSubscription {
  id: string;
  name: string;
  defaultColor: string;
  role?: string;
}

