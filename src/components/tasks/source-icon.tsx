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
 * - notion = 흰 바탕 + 공식 Notion 로고 (simple-icons, CC0)
 * - manual = WID 직접 입력 → 키컬러 점
 * - jira   = 공식 Jira 로고 (simple-icons, CC0) — 다크 가독을 위해 #2684FF 단색
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
        {/* Notion logo path: simple-icons (CC0).
          * 다크 전용 앱이라 로고를 흰색 단색으로 — 검정 로고+흰 박스 조합은
          * 글리프가 박스를 꽉 채워 다크에서 검은 덩어리로 보였음 (사용자 피드백). */}
        <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden role="img">
          <path
            fill="#fff"
            d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
          />
        </svg>
      </span>
    );
  }

  if (source === 'jira') {
    return (
      <span className={box} aria-label="Jira에서 온 task" title="Jira">
        {/* Jira logo path: simple-icons (CC0). 공식 블루는 #0052CC지만
          * 다크 배경에서 너무 어두워 밝은 브랜드 블루 #2684FF 단색으로. */}
        <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden role="img">
          <path
            fill="#2684FF"
            d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z"
          />
        </svg>
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
  jira_url?: string | null;
}): string | null {
  if (task.source === 'slack') return task.slack_url ?? null;
  if (task.source === 'notion') {
    return task.notion_url ?? (task.notion_task_id ? getNotionPageUrl(task.notion_task_id) : null);
  }
  if (task.source === 'jira') return task.jira_url ?? null;
  return null;
}
