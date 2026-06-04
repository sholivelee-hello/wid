'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navItems } from '@/lib/nav-items';
import { SyncButton } from '@/components/layout/sync-button';

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

  const settingsActive = pathname.startsWith('/settings');

  return (
    // 무채색 면 + hairline border (사용자 결정 2026-06-03, 보라 통판 폐기).
    // 다크 100% 사용 기준 — 사이드바는 본문과 거의 같은 어두운 무채색 표면
    // (--sidebar)으로 가라앉히고, 오른쪽 border만으로 본문과 구분한다.
    // 브랜드 식별은 통판이 아니라 로고 옆 키컬러 dot 한 점이 담당. 그림자 0(v3).
    <aside
      className={cn(
        'bg-sidebar border-r border-sidebar-border text-sidebar-foreground p-4 flex flex-col gap-1 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo + toggle */}
      <div className={cn('flex items-center justify-between px-2 py-3', collapsed && 'justify-center')}>
        {!collapsed && (
          <Link href="/today" aria-label="홈 (오늘)" className="group/logo inline-flex items-baseline gap-1 outline-none">
            {/* Pretendard 900 + 극단 자간. serif 없이 단단한 wordmark.
              * 워드마크 자체가 키컬러 — 미션 컨트롤 썸네일에서 좌상단 보라
              * "WID" 글자가 창 식별 앵커 (top bar·🟣 제목 마커 폐기 후의
              * 식별 장치, 사용자 결정 2026-06-03). */}
            <span
              className="font-black text-[21px] leading-none tracking-[-0.055em] text-primary"
            >
              WID
            </span>
            {/* 키컬러 dot — 워드마크와 같은 톤의 마침표. */}
            <span
              aria-hidden
              className="inline-block h-[6px] w-[6px] rounded-full translate-y-[-1px] bg-primary"
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                // 위계: 활성 = 은은한 pill(bg-sidebar-accent) + 흰 글자 + 3px 키컬러 레일.
                // 컬러는 "현재 위치"를 가리키는 레일 한 줄에만 — 면은 무채색을 유지한다.
                // 비활성 = muted-foreground, hover 시 미묘한 bg.
                'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-sidebar-accent text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
              )}
            >
              {isActive && !collapsed && (
                <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
              )}
              <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && item.label}
              {!collapsed && item.label === '전체' && inboxCount != null && inboxCount > 0 && (
                <span className="ml-auto text-[11px] font-semibold bg-primary/15 text-primary rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums">
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단 고정: 동기화 버튼 + 설정. mt-auto는 묶음 컨테이너로 옮겨 둘이 함께 바닥에 붙는다. */}
      <div className="mt-auto flex flex-col gap-1">
        {/* 전역 수동 동기화 — 어느 페이지에서도 Notion pull + 목록 갱신. */}
        <SyncButton collapsed={collapsed} />

        {/* 설정 — 글자 메뉴에서 빠지고 하단 고정 톱니바퀴 아이콘으로 (collapsed에서도 동일 위치). */}
        <Link
          href="/settings"
          title="설정"
          aria-label="설정"
          className={cn(
            'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'justify-center px-0' : '',
            settingsActive
              ? 'bg-sidebar-accent text-foreground font-semibold'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
          )}
        >
          {settingsActive && !collapsed && (
            <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
          )}
          <Settings className={cn('h-4 w-4 flex-shrink-0', settingsActive && 'text-primary')} />
          {!collapsed && '설정'}
        </Link>
      </div>
    </aside>
  );
}
