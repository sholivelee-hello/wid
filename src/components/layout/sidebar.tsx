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
import { CalendarSubscriptions } from './calendar-subscriptions';

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [inboxCount, setInboxCount] = useState<number | null>(null);

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
      <div className={cn('px-3 py-4', collapsed ? 'text-center' : '')}>
        <h1 className={cn('font-bold', collapsed ? 'text-base' : 'text-xl')}>
          {collapsed ? 'W' : 'WID'}
        </h1>
        <div className="h-1 w-8 bg-primary rounded-full mt-1 mx-auto" />
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
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-accent font-medium'
                    : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/60'
                )}
              >
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                {!collapsed && item.label}
                {!collapsed && item.label === '인박스' && inboxCount != null && inboxCount > 0 && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {inboxCount}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="border-t border-sidebar-border mt-2 pt-1">
          <CalendarSubscriptions />
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="self-center mt-2"
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
    </aside>
  );
}
