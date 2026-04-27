import { Clock, PlayCircle, CheckCircle2, UserCheck, XCircle, PauseCircle, LucideIcon } from 'lucide-react';
import { TASK_STATUSES, type TaskStatus } from '@/lib/types';

/** Canonical status list — same as TASK_STATUSES, re-exported for convenience. */
export const DEFAULT_STATUSES = TASK_STATUSES;

export const PRIORITIES = ['긴급', '높음', '보통', '낮음'] as const;

export const SOURCES = ['manual', 'notion', 'slack'] as const;

export const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  '등록': Clock,
  '진행중': PlayCircle,
  '대기중': PauseCircle,
  '완료': CheckCircle2,
  '위임': UserCheck,
  '취소': XCircle,
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  '등록': '#6B7280',
  '진행중': '#3B82F6',
  '대기중': '#F59E0B',
  '완료': '#10B981',
  '위임': '#8B5CF6',
  '취소': '#9CA3AF',
};

export const PRIORITY_COLORS: Record<string, string> = {
  '긴급': '#EF4444',
  '높음': '#F59E0B',
  '보통': '#6366F1',
  '낮음': '#9CA3AF',
};

export function getContrastTextColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
