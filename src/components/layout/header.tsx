'use client';

import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ChevronsDownUp, ChevronsUpDown, Settings } from 'lucide-react';
import { broadcastTreeSetAll } from '@/lib/use-tree-collapsed';
import { cn } from '@/lib/utils';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';
import { SyncButton } from '@/components/layout/sync-button';

const pageTitles: Record<string, string> = {
  '/inbox': '전체',
  '/today': '오늘',
  '/history': '돌아보기',
  '/settings': '설정',
};

const getTitle = (path: string) => {
  if (pageTitles[path]) return pageTitles[path];
  if (path.startsWith('/tasks/')) return 'task 상세';
  return 'WID';
};

export function Header() {
  const pathname = usePathname();
  const { openModal } = useQuickCapture();
  const title = getTitle(pathname);

  return (
    <>
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/90 dark:bg-background/85 backdrop-blur-md backdrop-saturate-150 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          {/* 햄버거 Sheet 제거 — 모바일 내비는 하단 탭바가 대체 (모바일 spec ④). */}
          <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => broadcastTreeSetAll(false)}
            aria-label="전체 펼치기"
            title="전체 펼치기"
            className="hidden lg:flex"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => broadcastTreeSetAll(true)}
            aria-label="전체 접기"
            title="전체 접기"
            className="hidden lg:flex"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
          {!pathname.startsWith('/settings') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={openModal}
              title="새 task 추가 (Ctrl+N)"
              className="hidden lg:inline-flex"
            >
              <Plus className="h-4 w-4 mr-1" />
              새 task
              <kbd className="ml-2 hidden sm:inline-flex text-[10px] font-mono bg-foreground/10 px-1 rounded border border-foreground/20">⌘N</kbd>
            </Button>
          )}
          {/* 모바일 우측 — Sheet 삭제로 잃은 동기화·설정 접근 보존. */}
          <div className="flex items-center gap-1 lg:hidden">
            <SyncButton collapsed />
            <Link
              href="/settings"
              aria-label="설정"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
