'use client';

import { NotionMapping } from '@/components/settings/notion-mapping';
import { SlackSettings } from '@/components/settings/slack-settings';
import { GCalSettings } from '@/components/settings/gcal-settings';
import { JiraSettings } from '@/components/settings/jira-settings';

// 섹션 점프 네비(segmented pill + scroll-spy)는 화면이 길지 않아 제거함
// (사용자 결정 2026-06-04). 카드 4장을 그냥 위에서 아래로 쌓는다.
export default function SettingsPage() {
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

      <div className="space-y-6">
        <GCalSettings />
        <NotionMapping />
        <SlackSettings />
        <JiraSettings />
      </div>
    </div>
  );
}
