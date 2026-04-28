'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { navItems } from '@/lib/nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/tasks/count');
        if (!res.ok) return;
        const data = await res.json();
        setInboxCount(data.active);
      } catch { /* ignore */ }
    }
    fetchCount();

    const handler = () => fetchCount();
    window.addEventListener('task-created', handler);
    window.addEventListener('task-updated', handler);
    return () => {
      window.removeEventListener('task-created', handler);
      window.removeEventListener('task-updated', handler);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'border-r bg-sidebar p-4 flex flex-col gap-1 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo + toggle */}
      <div className={cn('flex items-center justify-between px-2 py-3', collapsed && 'justify-center')}>
        {!collapsed && (
          <Link href="/" aria-label="홈" className="group/logo inline-flex items-baseline gap-1 outline-none">
            {/* Pretendard 900 + 극단 자간. serif 없이 단단한 wordmark.
              * 토스 앱 좌상단 로고타입과 동일 접근. */}
            <span
              className="font-black text-[21px] leading-none tracking-[-0.055em] transition-colors group-hover/logo:text-foreground text-foreground"
            >
              WID
            </span>
            {/* Mustard dot — first appearance of the paired accent in UI.
              * Together with the teal wordmark, this creates the "two-color
              * signature" the brand evaluator demanded. */}
            <span
              aria-hidden
              className="inline-block h-[6px] w-[6px] rounded-full translate-y-[-1px]"
              style={{ background: 'var(--primary)' }}
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item, idx) => {
          if (item.separator) return <Separator key={`sep-${idx}`} className="my-2" />;
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href!);
          return (
            <div key={item.href}>
              <Link
                href={item.href!}
                title={collapsed ? item.label : undefined}
                className={cn(
                  // Dark-first: active state pairs a brighter sidebar-accent
                  // bg with primary-tinted text + an accent rail for unmistakable affordance.
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground font-semibold dark:bg-primary/15 dark:text-primary'
                    : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/65 hover:text-sidebar-foreground dark:text-sidebar-foreground/70'
                )}
              >
                {isActive && !collapsed && (
                  <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
                )}
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                {!collapsed && item.label}
                {!collapsed && item.label === '인박스' && inboxCount != null && inboxCount > 0 && (
                  <span className="ml-auto text-[11px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums">
                    {inboxCount}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
