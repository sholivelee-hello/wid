'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { navItems } from '@/lib/nav-items';
import { useQuickCapture } from '@/components/tasks/quick-capture-provider';
import { cn } from '@/lib/utils';

// 모바일 하단 탭바 + FAB (모바일 spec ④) — 데스크톱 사이드바를 대체.
// 햄버거 Sheet를 폐기하고, 화면 하단에 항상 보이는 4탭 내비를 제공.
// lg 이상에서는 숨김(사이드바가 담당). 새 색 금지 — 기존 토큰만 사용.
export function MobileTabBar() {
  const pathname = usePathname();
  const { openModal } = useQuickCapture();
  const showFab = !pathname.startsWith('/settings');

  return (
    <>
      <nav
        aria-label="모바일 내비게이션"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-1 flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {showFab && (
        <button
          type="button"
          onClick={openModal}
          aria-label="새 task 추가"
          className="lg:hidden fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
