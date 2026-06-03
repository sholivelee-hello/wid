'use client';

import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Menu, ChevronsDownUp, ChevronsUpDown, Settings } from 'lucide-react';
import { broadcastTreeSetAll } from '@/lib/use-tree-collapsed';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { navItems } from '@/lib/nav-items';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';

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
          {/* Mobile menu trigger */}
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'lg:hidden'
              )}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="inline-flex items-baseline gap-1 font-black tracking-[-0.055em]">
                  WID
                  {/* 키컬러 dot — 사이드바와 동일한 브랜드 시그니처. */}
                  <span
                    aria-hidden
                    className="inline-block h-[6px] w-[6px] rounded-full translate-y-[-1px] bg-primary"
                  />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {[...navItems, { href: '/settings', label: '설정', icon: Settings }].map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        // 사이드바와 동일 언어: 활성 = pill + 3px 키컬러 레일 + 키컬러 아이콘.
                        'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isActive
                          ? 'bg-sidebar-accent text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                      )}
                    >
                      {isActive && (
                        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
                      )}
                      <item.icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => broadcastTreeSetAll(false)}
            aria-label="전체 펼치기"
            title="전체 펼치기"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => broadcastTreeSetAll(true)}
            aria-label="전체 접기"
            title="전체 접기"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
          {!pathname.startsWith('/settings') && (
            <Button size="sm" variant="ghost" onClick={openModal} title="새 task 추가 (Ctrl+N)">
              <Plus className="h-4 w-4 mr-1" />
              새 task
              <kbd className="ml-2 hidden sm:inline-flex text-[10px] font-mono bg-foreground/10 px-1 rounded border border-foreground/20">⌘N</kbd>
            </Button>
          )}
        </div>
      </header>
    </>
  );
}
