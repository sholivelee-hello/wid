import { Clock, CheckCircle2, XCircle, LucideIcon } from 'lucide-react';
import { TASK_STATUSES, type TaskStatus } from '@/lib/types';

/** Canonical status list — same as TASK_STATUSES, re-exported for convenience. */
export const DEFAULT_STATUSES = TASK_STATUSES;

export const SOURCES = ['manual', 'notion', 'slack'] as const;

export const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  '등록': Clock,
  '완료': CheckCircle2,
  '취소': XCircle,
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  '등록': '#6B7280',
  '완료': '#10B981',
  '취소': '#9CA3AF',
};

export function getContrastTextColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
