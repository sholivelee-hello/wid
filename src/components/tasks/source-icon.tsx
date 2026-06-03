import type { Source } from '@/lib/types';
import { cn, getNotionPageUrl } from '@/lib/utils';

interface SourceIconProps {
  source: Source;
  /** 14px 기본. 메타 줄에서 살짝 줄이고 싶을 때만 override. */
  className?: string;
}

/**
 * 출처 식별용 브랜드 아이콘 — **표시 전용** (클릭 동작 없음, hover 열기 없음).
 * 브랜드 컬러는 "한 화면 액센트 1개" 원칙의 예외로 SVG 내부에만 존재한다
 * (CLAUDE.md 디자인 섹션에 기록됨). 출처를 한눈에 구분하는 게 목적.
 *
 * - slack  = 공식 4색 로고 SVG
 * - notion = 흰 바탕 + 검정 N
 * - manual = WID 직접 입력 → 키컬러 점
 * - jira   = 슬롯 예약 (아이콘·연동 범위 외) → 회색 점 placeholder
 */
export function SourceIcon({ source, className }: SourceIconProps) {
  const box = cn('inline-flex items-center justify-center flex-shrink-0', className);

  if (source === 'slack') {
    return (
      <span className={box} aria-label="Slack에서 온 task" title="Slack">
        <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden role="img">
          <path fill="#E01E5A" d="M5.04 15.17a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.31a2.52 2.52 0 1 1-5.04 0v-6.31Z" />
          <path fill="#36C5F0" d="M8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.27a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 1 1 0-5.04h6.31Z" />
          <path fill="#2EB67D" d="M18.96 8.83a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.83Zm-1.27 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 1 1 5.04 0v6.31Z" />
          <path fill="#ECB22E" d="M15.17 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.27a2.52 2.52 0 0 1 0-5.04h6.31a2.52 2.52 0 1 1 0 5.04h-6.31Z" />
        </svg>
      </span>
    );
  }

  if (source === 'notion') {
    return (
      <span className={box} aria-label="Notion에서 온 task" title="Notion">
        <span className="inline-grid place-items-center h-[14px] w-[14px] rounded-[3px] bg-white text-black text-[10px] font-bold leading-none">
          N
        </span>
      </span>
    );
  }

  if (source === 'jira') {
    // 슬롯 예약 — 실제 아이콘·연동은 별도 스펙. 무채색 점 placeholder.
    return (
      <span className={box} aria-label="Jira에서 온 task" title="Jira">
        <span aria-hidden className="inline-block h-[8px] w-[8px] rounded-full bg-muted-foreground/50" />
      </span>
    );
  }

  // manual = WID 직접 입력 → 키컬러 점.
  return (
    <span className={box} aria-label="직접 입력한 task" title="직접 입력">
      <span aria-hidden className="inline-block h-[8px] w-[8px] rounded-full bg-primary" />
    </span>
  );
}

/** 우클릭 "원본 열기"가 가리킬 외부 URL. 없으면 null (메뉴 항목 숨김). */
export function sourceOpenUrl(task: {
  source: Source;
  slack_url: string | null;
  notion_url: string | null;
  notion_task_id: string | null;
}): string | null {
  if (task.source === 'slack') return task.slack_url ?? null;
  if (task.source === 'notion') {
    return task.notion_url ?? (task.notion_task_id ? getNotionPageUrl(task.notion_task_id) : null);
  }
  return null;
}
