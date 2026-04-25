export type Priority = '긴급' | '높음' | '보통' | '낮음';
export type Source = 'manual' | 'notion' | 'slack';
export type SortMode = 'checklist' | 'sequential';

export interface Issue {
  id: string;
  name: string;
  color: string;                  // hex like '#94a3b8'
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
  status: string;
  source: Source;
  requester: string | null;
  requested_at: string | null;
  created_at: string;
  deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  actual_duration: number | null;
  is_duration_manual: boolean;
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

export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface NotionStatusMapping {
  id: string;
  notion_status: string;
  wid_status: string;
}

export interface DailyStats {
  date: string;
  completed_count: number;
  total_duration: number;
  in_progress_count: number;
  tasks: Task[];
  timelogs: TimeLog[];
}

