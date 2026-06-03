import {
  Inbox,
  Sun,
  History,
  Folder,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// 메뉴 4개 (spec 2026-06-03 평평한 리스트·이슈 페이지): 오늘·전체·이슈·돌아보기.
// 보류함·휴지통은 /inbox 보기 칩으로, 설정은 사이드바 하단 톱니바퀴로 흡수.
export const navItems: NavItem[] = [
  { href: '/today', label: '오늘', icon: Sun },
  { href: '/inbox', label: '전체', icon: Inbox },
  { href: '/issues', label: '이슈', icon: Folder },
  { href: '/history', label: '돌아보기', icon: History },
];
