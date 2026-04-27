'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Moon, Sun, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { navItems } from '@/lib/nav-items';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';

const pageTitles: Record<string, string> = {
  '/': '인박스',
  '/today': '오늘',
  '/history': '히스토리',
  '/settings': '설정',
  '/tasks/trash': '휴지통',
};

const getTitle = (path: string) => {
  if (pageTitles[path]) return pageTitles[path];
  if (path.startsWith('/tasks/') && path !== '/tasks/trash') return 'task 상세';
  return 'WID';
};

export function Header() {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const { openModal } = useQuickCapture();
  const title = getTitle(pathname);

  return (
    <>
      <header className="h-14 border-b flex items-center justify-between px-6">
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
                <SheetTitle style={{ fontFamily: 'var(--font-heading)' }}>WID</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {navItems.map((item, idx) => {
                  if (item.separator) return <Separator key={`sep-${idx}`} className="my-2" />;
                  const isActive = item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href!);
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href!}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isActive
                            ? 'bg-sidebar-accent font-medium'
                            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/60'
                        )}
                      >
                        {item.icon && <item.icon className="h-4 w-4" />}
                        {item.label}
                      </Link>
                    </div>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="테마 전환"
          >
            <Sun className="h-4 w-4 hidden dark:block" />
            <Moon className="h-4 w-4 block dark:hidden" />
          </Button>
          {!pathname.startsWith('/settings') && pathname !== '/' && (
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
