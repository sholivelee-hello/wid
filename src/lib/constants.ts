import { Clock, PlayCircle, CheckCircle2, UserCheck, XCircle, PauseCircle, CircleDot, LucideIcon } from 'lucide-react';

export const DEFAULT_STATUSES = [
  '대기', '진행중', '완료', '위임', '취소', '보류', '부분완료',
] as const;

export const PRIORITIES = ['긴급', '높음', '보통', '낮음'] as const;

export const SOURCES = ['manual', 'notion', 'slack'] as const;

export const STATUS_ICONS: Record<string, LucideIcon> = {
  '대기': Clock,
  '진행중': PlayCircle,
  '완료': CheckCircle2,
  '위임': UserCheck,
  '취소': XCircle,
  '보류': PauseCircle,
  '부분완료': CircleDot,
};

export const STATUS_COLORS: Record<string, string> = {
  '대기': '#9CA3AF',
  '진행중': '#3B82F6',
  '완료': '#10B981',
  '위임': '#F59E0B',
  '취소': '#EF4444',
  '보류': '#8B5CF6',
  '부분완료': '#06B6D4',
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
