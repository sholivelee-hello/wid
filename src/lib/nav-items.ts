import {
  Inbox,
  Sun,
  History,
  Settings,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  href?: string;
  label?: string;
  icon?: LucideIcon;
  separator?: boolean;
};

export const navItems: NavItem[] = [
  { href: '/', label: '인박스', icon: Inbox },
  { href: '/today', label: '오늘', icon: Sun },
  { separator: true },
  { href: '/history', label: '히스토리', icon: History },
  { href: '/settings', label: '설정', icon: Settings },
  { separator: true },
  { href: '/tasks/trash', label: '휴지통', icon: Trash2 },
];
