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

  // Scroll-based spy.  IntersectionObserver was misfiring when a short
  // section (e.g. Notion) entered and exited inside the same callback batch
  // along with the next section — entries.sort()[0] then resolved to the
  // *wrong* id, so clicking "Notion" highlighted "Slack".  We now read every
  // section's geometry directly on each scroll, which is O(N=3) and stable.
  useEffect(() => {
    const scroller = document.getElementById('main-content');
    type Resolved = { id: typeof SECTIONS[number]['id']; el: HTMLElement };
    const sections: Resolved[] = SECTIONS
      .map(s => ({ id: s.id, el: document.getElementById(s.id) }))
      .filter((s): s is Resolved => s.el !== null);
    if (sections.length === 0 || !scroller) return;

    // header(56) + sticky-nav(48) + breathing(8)
    const offset = 112;

    const recompute = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const rect = s.el.getBoundingClientRect();
        if (rect.top - offset <= 0) current = s.id;
        else break;
      }
      setActiveId(current);
    };

    recompute();
    scroller.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    return () => {
      scroller.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  const activeIdx = SECTIONS.findIndex((s) => s.id === activeId);

  return (
    <div className="space-y-6">
      {/* Hero — same rhythm as Inbox / Today / History so the whole app
       * shares one first-impression pattern. */}
      <section className="animate-soft-rise">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/70 mb-2.5">
          연결과 동기화
        </p>
        <h1
          className="text-[28px] sm:text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em]"
        >
          설정
        </h1>
        <p className="text-[12.5px] sm:text-[13px] text-muted-foreground/80 mt-2 tracking-[-0.005em]">
          외부 서비스 연동을 관리해요.
        </p>
      </section>

      {/* Segmented section nav — Toss/한국 IT pill-segment style. Active pill
       * gets card surface + ring; inactive stays muted. Sticky to the top of
       * the scroll container so it's always reachable. */}
      <nav
        className="sticky top-0 z-10 bg-background/85 dark:bg-background/85 backdrop-blur-md backdrop-saturate-150 -mx-4 md:-mx-6 px-4 md:px-6 py-2 border-b border-border/60 flex items-center gap-2"
        aria-label="설정 섹션 네비게이션"
      >
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/70 dark:bg-muted/50">
          {SECTIONS.map((section) => {
            const isActive = activeId === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setActiveId(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center justify-center px-3.5 h-8 rounded-full text-[12.5px] font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'active:scale-[0.97]',
                  isActive
                    ? 'bg-background text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
              </a>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {Math.max(activeIdx + 1, 1)} / {SECTIONS.length}
        </span>
      </nav>

      <div className="space-y-6">
        <div id="gcal" className="scroll-mt-[120px]">
          <GCalSettings />
        </div>
        <div id="notion" className="scroll-mt-[120px]">
          <NotionMapping />
        </div>
        <div id="slack" className="scroll-mt-[120px]">
          <SlackSettings />
        </div>
      </div>
    </div>
  );
}
