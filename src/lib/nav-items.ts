import {
  Inbox,
  Sun,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// IA 단순화 (spec 2026-06-03): 메뉴 3개. 보류함·휴지통은 /inbox 보기 칩으로,
// 설정은 사이드바 하단 톱니바퀴로 흡수.
export const navItems: NavItem[] = [
  { href: '/today', label: '오늘', icon: Sun },
  { href: '/inbox', label: '전체', icon: Inbox },
  { href: '/history', label: '돌아보기', icon: History },
];
