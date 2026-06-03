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
    // 키컬러 기둥 — 웹앱(독립 창)으로 쓸 때 미션 컨트롤 썸네일에서
    // "왼쪽 보라 기둥 = WID"로 즉시 식별되는 브랜드 표면 (사용자 결정 2026-06-03).
    // v3 "한 화면 액센트 1개"의 그 1개가 사이드바 전체로 승격된 형태.
    <aside
      className={cn(
        'bg-primary p-4 flex flex-col gap-1 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo + toggle */}
      <div className={cn('flex items-center justify-between px-2 py-3', collapsed && 'justify-center')}>
        {!collapsed && (
          <Link href="/" aria-label="홈" className="group/logo inline-flex items-baseline gap-1 outline-none">
            {/* Pretendard 900 + 극단 자간. serif 없이 단단한 wordmark.
              * 키컬러 기둥 위라 흰색 반전. */}
            <span
              className="font-black text-[21px] leading-none tracking-[-0.055em] text-primary-foreground"
            >
              WID
            </span>
            {/* 점은 배경과 같은 키컬러 대신 흰색 — 기둥 위에서의 시그니처. */}
            <span
              aria-hidden
              className="inline-block h-[6px] w-[6px] rounded-full translate-y-[-1px] bg-primary-foreground"
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item, idx) => {
          if (item.separator) return <Separator key={`sep-${idx}`} className="my-2 bg-primary-foreground/20" />;
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href!);
          return (
            <div key={item.href}>
              <Link
                href={item.href!}
                title={collapsed ? item.label : undefined}
                className={cn(
                  // 키컬러 기둥 위 — 위계는 흰색 불투명도로만: 활성 = 반투명 흰 배경
                  // + 흰 레일, 비활성 = 70% 흰 글자. 라이트/다크 동일 (배경이 이미 brand).
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary-foreground/15 text-primary-foreground font-semibold'
                    : 'hover:bg-primary-foreground/10 text-primary-foreground/70 hover:text-primary-foreground'
                )}
              >
                {isActive && !collapsed && (
                  <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary-foreground" />
                )}
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                {!collapsed && item.label}
                {!collapsed && item.label === '인박스' && inboxCount != null && inboxCount > 0 && (
                  <span className="ml-auto text-[11px] font-semibold bg-primary-foreground text-primary rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums">
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
