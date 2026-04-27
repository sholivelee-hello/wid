'use client';

import { useEffect, useState } from 'react';
import { NotionMapping } from '@/components/settings/notion-mapping';
import { SlackSettings } from '@/components/settings/slack-settings';
import { GCalSettings } from '@/components/settings/gcal-settings';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'gcal', label: 'Google Calendar' },
  { id: 'notion', label: 'Notion 연동' },
  { id: 'slack', label: 'Slack 연동' },
] as const;

export default function SettingsPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const targets = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // pick the entry closest to the top that is currently intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // header(56px) + sticky(48px) ≈ 104px → top margin -112px
        // bottom margin 완화: 마지막 짧은 섹션도 viewport 하단 30%만 들어가도 잡힘
        rootMargin: '-112px 0px -30% 0px',
        threshold: 0,
      }
    );

    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const activeIdx = SECTIONS.findIndex((s) => s.id === activeId);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          연동 서비스를 설정할 수 있습니다.
        </p>
      </div>
      <nav
        className="!mt-0 sticky top-0 z-10 bg-background border-b h-12 flex items-center gap-1 text-sm"
        aria-label="설정 섹션 네비게이션"
      >
        {SECTIONS.map((section) => {
          const isActive = activeId === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                'relative px-3 py-1.5 rounded-md transition-colors hover:bg-accent',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
              aria-current={isActive ? 'true' : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary transition-opacity duration-150 ease-out',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              />
              {section.label}
            </a>
          );
        })}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums pr-1">
          {Math.max(activeIdx + 1, 1)} / {SECTIONS.length}
        </span>
      </nav>
      <div id="gcal" className="scroll-mt-[104px]">
        <GCalSettings />
      </div>
      <div id="notion" className="scroll-mt-[104px]">
        <NotionMapping />
      </div>
      <div id="slack" className="scroll-mt-[104px]">
        <SlackSettings />
      </div>
    </div>
  );
}
