# 평평한 리스트 + 이슈 페이지 + 노션 name_locked Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 TASK를 ISSUE와 무관하게 평평한 최신순 리스트로 보여주고(카드에 소속 ISSUE 칩 노출), ISSUE별 모아보기를 위한 `/issues` 목록·상세 페이지를 신설하며, 노션発 task 이름을 WID에서 보호하는 `name_locked` 플래그를 도입한다.

**Architecture:** `/inbox`는 트리·드래그를 걷어내고 평면 리스트로 단순화하고, 드래그 reorder는 `/issues/[id]` 상세에만 남긴다(1-context). 카드는 두 줄 구성으로 통일하며 출처는 브랜드 아이콘으로만 표시한다. 노션 동기화는 `name_locked=false`인 task만 제목을 덮어쓰고, WID UI에서 노션발 task 이름을 고치면 플래그를 세팅해 영구 보호한다(완료 동기화는 ID 매칭으로 현행 유지).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui, Supabase, @dnd-kit

---

## 스펙 ↔ Task 매핑 요약

| 스펙 섹션 | 커버하는 Task |
|---|---|
| 1. /inbox 평평한 리스트 | 4(카드), 5(평면 리스트), 3(출처 아이콘·원본 열기) |
| 2. 사이드바 메뉴 4개 | 8 |
| 3. /issues 목록 페이지 | 9 |
| 4. /issues/[id] 상세 개편 | 10 |
| 5. 노션 동기화 규칙 (name_locked) | 1(마이그/타입), 2(sync 가드·세팅) |
| 6. 영향 범위 / 본문 폭 / 문서 | 6(today), 7(720px), 11(문서) |
| 범위 외 (jira 슬롯 예약) | 1(enum slot), 3(아이콘 슬롯) |

---

## Task 0: 미커밋 베이스라인 정리 커밋

현재 워킹트리에 오늘 작업(IA 단순화·다크 전용·상태 3값·우클릭 메뉴·`/inbox` 신설 등)이 커밋되지 않은 채 24개 수정 + 신규 파일로 쌓여 있다. 이후 task들이 깨끗한 트리에서 시작하도록 이 변경을 단일 베이스라인 커밋으로 정리한다. **새 코드 작성 없음 — 현재 상태를 그대로 커밋.**

**Files:**
- Commit only: 워킹트리 전체 (`git add -A`)

- [ ] **Step 1: 커밋 author 확인** — 이 레포는 개인 메일로 커밋해야 한다.
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID config user.email
  ```
  기대 출력: `sholivelee@gmail.com` (아니면 중단하고 사용자에게 알릴 것 — 회사 메일 노출 금지).

- [ ] **Step 2: 변경 범위 확인** — 의도치 않은 파일이 섞이지 않았는지 본다.
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID status --short
  ```
  기대: `src/app/inbox/`, `src/components/inbox/`, `src/components/ui/context-menu.tsx`, `supabase/migrations/007_status_three_values.sql`, 다수 `M` 항목. `.env*`·비밀키가 없어야 한다.

- [ ] **Step 3: 빌드 확인** — 커밋 전 현재 트리가 빌드되는지.
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0.

- [ ] **Step 4: Commit** — 전체를 한 커밋으로.
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add -A
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: IA 단순화 베이스라인 — 메뉴 3개·다크 전용·상태 3값·우클릭 메뉴·/inbox 신설

- 시작 화면 /today, /inbox 보기 칩(등록/보류/완료/휴지통)
- 상태 3값(등록·완료·취소) 마이그레이션 007
- TaskCard 우클릭 ContextMenu, 보류/휴지통 뷰 컴포넌트 추출

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```
  기대: 커밋 1개 생성. `git status` clean.

---

## Task 1: 마이그레이션 008 (name_locked + jira 슬롯) + 타입 반영

`tasks.name_locked`(boolean, default false)를 추가하고, source CHECK 제약에 `jira` 슬롯을 예약한다(아이콘·연동은 범위 외, enum 값만 허용). TypeScript 타입에도 반영한다.

**Files:**
- Create: `supabase/migrations/008_name_locked.sql`
- Modify: `src/lib/types.ts` (1행 `Source` 유니온, `Task` 인터페이스에 `name_locked` 추가)

- [ ] **Step 1: 마이그레이션 파일 작성** — `supabase/migrations/008_name_locked.sql`
  ```sql
  -- 노션発 task 이름 보호 플래그. 사용자가 WID UI에서 노션 task 이름을
  -- 수정하면 true로 세팅되고, 이후 노션 동기화는 그 task의 제목을 덮어쓰지
  -- 않는다 (완료 동기화는 notion_task_id 매칭이라 이름과 무관하게 동작).
  alter table tasks
    add column if not exists name_locked boolean not null default false;

  -- jira 슬롯 예약 — source enum에 'jira'를 허용값으로만 추가한다.
  -- 아이콘·실연동은 이번 범위 밖(별도 스펙). 값만 받을 수 있게 제약 갱신.
  alter table tasks drop constraint if exists tasks_source_check;
  alter table tasks add constraint tasks_source_check
    check (source in ('manual', 'notion', 'slack', 'jira'));
  ```

- [ ] **Step 2: 타입 반영** — `src/lib/types.ts` 1행 `Source` 유니온에 `jira` 추가.
  ```ts
  export type Source = 'manual' | 'notion' | 'slack' | 'jira';
  ```

- [ ] **Step 3: 타입 반영** — `src/lib/types.ts` `Task` 인터페이스에 `name_locked` 필드 추가. `is_deleted: boolean;` 바로 위에 삽입.
  ```ts
    issue_id: string | null;
    parent_task_id: string | null;
    sort_mode: SortMode;
    position: number;
    pending_at: string | null;
    name_locked: boolean;
    is_deleted: boolean;
  ```

- [ ] **Step 4: 마이그레이션 적용** — 실행자가 Supabase MCP `apply_migration`으로 `008_name_locked.sql`을 적용한다 (name=`name_locked`). 적용 후 `list_tables`로 `tasks.name_locked` 컬럼 존재를 확인.

- [ ] **Step 5: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0.

- [ ] **Step 6: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add supabase/migrations/008_name_locked.sql src/lib/types.ts
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: name_locked 플래그 + jira source 슬롯 (마이그레이션 008)

- tasks.name_locked boolean default false
- source CHECK에 'jira' 허용값 예약 (연동은 범위 외)
- Source 유니온 + Task 타입 반영

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 2: 노션 sync name_locked 가드 + 이름 수정 시 플래그 세팅

노션 sync가 `name_locked=true`인 task의 제목은 덮어쓰지 않게 가드한다. 그리고 WID UI(인라인 에디터·상세 패널)에서 source가 `notion`인 task의 제목을 수정하면 `name_locked=true`를 함께 PATCH한다. 완료 동기화(notion_task_id 매칭 → 완료)는 손대지 않는다.

**Files:**
- Modify: `src/app/api/notion/sync/route.ts` (기존 task select에 `name_locked` 추가 ~273행, 제목 덮어쓰기 가드 ~279행)
- Modify: `src/components/tasks/task-inline-editor.tsx` (제목 onBlur 저장 ~147행)
- Modify: `src/components/tasks/task-detail-panel.tsx` (제목 onBlur 저장 ~246행)

- [ ] **Step 1: sync select에 name_locked 포함** — `src/app/api/notion/sync/route.ts` 의 기존 task 조회(약 271~275행)에서 select 컬럼에 `name_locked`를 추가한다.
  변경 전:
  ```ts
        const { data: existing } = await supabase
          .from('tasks')
          .select('id, title, deadline, issue_id, requester, notion_url, status')
          .eq('notion_task_id', page.id)
          .maybeSingle();
  ```
  변경 후:
  ```ts
        const { data: existing } = await supabase
          .from('tasks')
          .select('id, title, deadline, issue_id, requester, notion_url, status, name_locked')
          .eq('notion_task_id', page.id)
          .maybeSingle();
  ```

- [ ] **Step 2: 제목 덮어쓰기 가드** — `src/app/api/notion/sync/route.ts` 의 제목 업데이트 라인(약 279행)을 `name_locked`가 아닐 때만 따르도록 수정한다.
  변경 전:
  ```ts
          const updates: Record<string, unknown> = {};
          if (title && existing.title !== title) updates.title = title;
  ```
  변경 후:
  ```ts
          const updates: Record<string, unknown> = {};
          // name_locked = 사용자가 WID에서 이름을 직접 고친 task. 노션 제목으로
          // 덮어쓰지 않는다. 완료 동기화는 notion_task_id 매칭이라 이름과 무관하게
          // 그대로 동작한다(아래 status 블록은 그대로 둔다).
          if (title && existing.title !== title && !existing.name_locked) {
            updates.title = title;
          }
  ```

- [ ] **Step 3: 인라인 에디터 — notion task 제목 수정 시 플래그 세팅** — `src/components/tasks/task-inline-editor.tsx` 제목 Input의 onBlur(약 147행)에서 source가 notion일 때 `name_locked: true`를 함께 저장한다.
  변경 전:
  ```tsx
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== task.title) save({ title: title.trim() });
        }}
        aria-label="제목"
      />
  ```
  변경 후:
  ```tsx
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== task.title) {
            // 노션発 task의 이름을 WID에서 고치면 이후 노션 제목 변경을 따르지
            // 않도록 잠근다 (name_locked). 다른 출처는 플래그가 무의미하므로 안 보냄.
            const patch: Record<string, unknown> = { title: title.trim() };
            if (task.source === 'notion') patch.name_locked = true;
            save(patch);
          }
        }}
        aria-label="제목"
      />
  ```

- [ ] **Step 4: 상세 패널 — notion task 제목 수정 시 플래그 세팅** — `src/components/tasks/task-detail-panel.tsx` 제목 Input의 onBlur(약 246행)에서 동일하게 처리한다.
  변경 전:
  ```tsx
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={async () => {
                    if (task && title !== task.title && title.trim()) {
                      try {
                        await apiFetch(`/api/tasks/${taskId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title }),
                        });
                        onTaskUpdated?.();
                      } catch {}
                    }
                  }}
  ```
  변경 후:
  ```tsx
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={async () => {
                    if (task && title !== task.title && title.trim()) {
                      try {
                        // 노션発 task는 이름을 고치면 name_locked로 잠가 이후 노션
                        // 제목 변경을 따르지 않게 한다.
                        const patch: Record<string, unknown> = { title };
                        if (task.source === 'notion') patch.name_locked = true;
                        await apiFetch(`/api/tasks/${taskId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(patch),
                        });
                        onTaskUpdated?.();
                      } catch {}
                    }
                  }}
  ```

- [ ] **Step 5: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0. (`PATCH /api/tasks/[id]`는 body를 그대로 update에 넘기므로 `name_locked` 컬럼이 자동 반영된다 — 라우트 수정 불필요.)

- [ ] **Step 6: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/app/api/notion/sync/route.ts src/components/tasks/task-inline-editor.tsx src/components/tasks/task-detail-panel.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: 노션 sync name_locked 가드 + WID 이름 수정 시 잠금

- sync는 name_locked=false인 노션 task만 제목 덮어쓰기
- 인라인 에디터·상세 패널에서 notion task 제목 수정 시 name_locked=true
- 완료 동기화(notion_task_id 매칭)는 현행 유지

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 3: 출처 브랜드 아이콘 컴포넌트 + 우클릭 "원본 열기"

출처를 실제 브랜드 로고로 표시하는 `SourceIcon` 컴포넌트를 신설한다(슬랙 4색 SVG / 노션 흰 바탕 검정 N / WID 키컬러 점 / jira 슬롯 예약). 클릭 동작은 없다(표시 전용). 그리고 우클릭 컨텍스트 메뉴 맨 위에 "원본 열기"(slack_url 또는 notion 페이지가 있는 task만, 새 탭)를 추가한다.

**Files:**
- Create: `src/components/tasks/source-icon.tsx`
- Modify: `src/components/tasks/task-card.tsx` (contextMenuContent 맨 위에 "원본 열기" 추가, import 추가)

- [ ] **Step 1: SourceIcon 컴포넌트 작성** — `src/components/tasks/source-icon.tsx`. 새 색 금지 원칙의 예외(브랜드 아이콘)이므로 브랜드 컬러는 SVG 내부에만 둔다.
  ```tsx
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
  ```

- [ ] **Step 2: TaskCard 우클릭 메뉴 맨 위 "원본 열기" 추가** — `src/components/tasks/task-card.tsx`. 먼저 import 추가(파일 상단 import 블록, `getNotionPageUrl`는 이미 import됨):
  ```tsx
  import { SourceIcon, sourceOpenUrl } from '@/components/tasks/source-icon';
  ```
  그리고 `contextMenuContent` 내부, `<ContextMenuContent>` 바로 다음(완료 항목 위)에 "원본 열기"를 삽입한다. 변경 전:
  ```tsx
    const contextMenuContent = (
      <ContextMenuContent>
        <ContextMenuItem
          disabled={completeBlocked}
  ```
  변경 후:
  ```tsx
    const openUrl = sourceOpenUrl(task);
    const contextMenuContent = (
      <ContextMenuContent>
        {openUrl && (
          <>
            <ContextMenuItem onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}>
              <ExternalLink />
              원본 열기
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          disabled={completeBlocked}
  ```
  (`ExternalLink`, `ContextMenuSeparator`는 이미 import되어 있다.)

- [ ] **Step 3: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0.

- [ ] **Step 4: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/components/tasks/source-icon.tsx src/components/tasks/task-card.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: 출처 브랜드 아이콘 컴포넌트 + 우클릭 원본 열기

- SourceIcon: 슬랙 4색 SVG / 노션 검정 N / WID 키컬러 점 / jira 슬롯
- 표시 전용(클릭 동작 없음). 우클릭 메뉴 맨 위 "원본 열기" 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 4: 두 줄 카드로 task-card 개편

`TaskCard`를 두 줄 구성으로 정리한다. 1행 = 완료 동그라미 + 출처 아이콘 + 제목. 2행 메타 = ISSUE 칩 · 마감일 · 요청자 · `↳ sub N` (없는 항목 생략, 메타 전부 없으면 한 줄). 해(오늘) 버튼·상태 드롭다운·⋯ 더보기 버튼을 카드에서 **제거**하고 우클릭 메뉴·상세 패널로 일원화한다. ISSUE 칩 클릭 → 상세 이동, `↳ sub N` 클릭 → 그 자리 펼침 토글.

ISSUE 칩과 sub N 토글은 평면 리스트(Task 5)와 Today(Task 6)에서 필요하므로 props로 받는다. 기존 `breadcrumb`/`reasonBadge`/`isSubtask`/`hasChildren`/`editing`은 유지(Today·트리에서 계속 사용).

**Files:**
- Modify: `src/components/tasks/task-card.tsx` (props 추가, Actions 블록 제거, 1행/2행 재구성)

- [ ] **Step 1: import 정리 + props 추가** — `src/components/tasks/task-card.tsx`. 제거되는 UI(상태 Select, ⋯ DropdownMenu)에 쓰이던 import를 정리하고 ISSUE 칩/서브 토글 props를 추가한다. 먼저 상단 import에서 `Select` 계열과 `DropdownMenu` 계열을 제거하고, `Link`를 추가한다.
  변경 전(파일 1~43행 import 블록 중):
  ```tsx
  import { useState, useEffect } from 'react';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    ContextMenu,
  ```
  변경 후:
  ```tsx
  import { useState, useEffect } from 'react';
  import Link from 'next/link';
  import {
    ContextMenu,
  ```
  그리고 lucide import(28~43행)에서 더 이상 안 쓰는 `MoreHorizontal`을 제거한다(나머지는 유지). `FolderOpen`은 ISSUE 칩에 계속 쓴다.

- [ ] **Step 2: TaskCardProps에 ISSUE 칩 + 서브 토글 props 추가** — `interface TaskCardProps` 안, `reasonBadge?: 'deadline';` 다음에 추가.
  ```tsx
    /** 카드 2행 메타에 표시할 소속 ISSUE. 평면 리스트(/inbox)에서 사용.
     *  칩 클릭 시 `/issues/[id]`로 이동한다. 없으면 칩 생략. */
    issueChip?: { id: string; name: string } | null;
    /** 직속 sub-TASK 개수. 0보다 크면 2행에 `↳ sub N` 토글을 렌더한다. */
    subCount?: number;
    /** sub 펼침 상태 (부모가 소유). `↳ sub N` 클릭 시 onToggleSubs 호출. */
    subsExpanded?: boolean;
    onToggleSubs?: () => void;
  ```

- [ ] **Step 3: 함수 시그니처에 새 props 구조분해 추가** — `export function TaskCard({ ... })` 인자 목록의 `reasonBadge,` 다음에 추가.
  ```tsx
    reasonBadge,
    issueChip,
    subCount = 0,
    subsExpanded = false,
    onToggleSubs,
  ```

- [ ] **Step 4: 해(오늘) 토글 버튼 제거** — `src/components/tasks/task-card.tsx` 의 "1-tap 오늘 토글" 버튼 블록(현재 313~339행, `{/* 1-tap "오늘 토글" */}` 주석부터 그 `</button>`까지) 전체를 삭제한다. 오늘 토글은 우클릭 메뉴에 이미 있다(현재 157~165행 유지). `todayPulse` state와 `setTodayPulse` 사용처는 우클릭 메뉴 쪽에 남아 있으므로 state 선언은 유지한다.

- [ ] **Step 5: 1행을 출처 아이콘 + 제목으로 재구성** — 제목 블록(현재 341~406행 `{/* Title + metadata */}`)에서 `breadcrumb` 렌더와 제목 줄을 유지하되, 제목 `<span>` 바로 앞에 `SourceIcon`을 넣는다. 제목 줄 컨테이너(현재 367행 `<div className="flex items-center gap-2">`) 내부, `{isSubtask && (...↳...)}` 블록 다음, `{reasonBadge === 'deadline' && ...}` 앞에 삽입.
  ```tsx
              {/* 출처 브랜드 아이콘 — 표시 전용. 제목 바로 앞. */}
              <SourceIcon source={task.source} className="flex-shrink-0" />
  ```
  먼저 import 추가(파일 상단):
  ```tsx
  import { SourceIcon, sourceOpenUrl } from '@/components/tasks/source-icon';
  ```
  (Task 3 Step 2에서 이미 추가했다면 중복 추가하지 말 것 — Task 3과 4는 같은 파일을 건드리므로 순차 실행하며 import는 한 번만 둔다.)

- [ ] **Step 6: 2행 메타를 ISSUE 칩 · 마감 · 요청자 · sub N 으로 교체** — 메타 줄(현재 408~465행 `<div className="flex items-center gap-x-2.5 ...">`) 전체를 아래로 교체한다. 기존 notion/slack 인라인 링크 아이콘은 출처 아이콘 + 우클릭 "원본 열기"로 일원화되므로 제거한다.
  변경 전:
  ```tsx
              <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
                {task.deadline && (
                  ...
                )}
                {task.requester && (
                  ...
                )}
                {task.source === 'notion' && task.notion_task_id && (
                  ...
                )}
                {task.source === 'slack' && task.slack_url && (
                  ...
                )}
              </div>
  ```
  변경 후(메타가 하나도 없으면 줄 자체를 렌더하지 않아 "한 줄 카드"가 된다):
  ```tsx
              {(issueChip || task.deadline || task.requester || subCount > 0) && (
                <div className="flex items-center gap-x-2.5 gap-y-1 text-xs flex-wrap text-muted-foreground">
                  {issueChip && (
                    <Link
                      href={`/issues/${issueChip.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 max-w-[180px] px-1.5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      title={issueChip.name}
                    >
                      <FolderOpen className="h-3 w-3 flex-shrink-0" aria-hidden />
                      <span className="truncate font-medium">{issueChip.name}</span>
                    </Link>
                  )}
                  {task.deadline && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        weight === 'heavy' && !isDone && 'text-primary font-medium',
                      )}
                    >
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                    </span>
                  )}
                  {task.requester && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" aria-hidden="true" />
                      {task.requester}
                    </span>
                  )}
                  {subCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSubs?.(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-expanded={subsExpanded}
                      className="inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                    >
                      <span aria-hidden>↳</span> sub {subCount}
                      <span className="text-muted-foreground/60">{subsExpanded ? '· 접기' : '· 펼치기'}</span>
                    </button>
                  )}
                </div>
              )}
  ```

- [ ] **Step 7: Actions 블록(상태 Select + ⋯ 드롭다운) 제거** — `{/* Actions */}` 주석부터 시작하는 `<div className="flex items-center gap-1 flex-shrink-0" ...>` 블록(현재 468~538행) 전체를 삭제한다. 상태 변경·삭제·보류·Slack 보기는 모두 우클릭 메뉴에 이미 존재한다. `handleStatusSelect` 함수(현재 127~131행)도 더 이상 쓰이지 않으므로 삭제한다.

- [ ] **Step 8: Dot 헬퍼 정리** — `Dot()` 컴포넌트(현재 79~81행)가 더 이상 참조되지 않으면 삭제한다 (메타 줄을 칩/버튼 기반으로 바꿔 `<Dot/>` 사용처가 사라짐). `MessageSquare`, `FileText` lucide import도 메타 줄에서만 쓰였으면 제거한다 (우클릭 메뉴는 `ExternalLink`만 사용).

- [ ] **Step 9: 검증** — 타입·미사용 변수 에러가 가장 잘 잡히는 지점이다.
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러(미사용 import/변수 0).

- [ ] **Step 10: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/components/tasks/task-card.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: 두 줄 카드로 TaskCard 개편 — 출처 아이콘·ISSUE 칩·sub N 토글

- 1행: 완료 동그라미 + 출처 아이콘 + 제목
- 2행 메타: ISSUE 칩 · 마감 · 요청자 · ↳ sub N (없으면 생략, 전무 시 한 줄)
- 해 버튼·상태 드롭다운·⋯ 더보기 제거 → 우클릭/상세 패널로 일원화

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 5: /inbox 평평한 리스트 (트리·드래그 제거)

`/inbox` 등록 뷰를 ISSUE 그룹핑·트리 들여쓰기 없는 단일 평면 리스트로 바꾼다. 정렬은 등록 최신순(created_at desc). 드래그 reorder 제거. sub-TASK는 평소 숨김 — 부모 카드 `↳ sub N` 토글로 그 자리 펼침. 카드는 Task 4의 두 줄 카드(`issueChip`/`subCount`/`subsExpanded`/`onToggleSubs` 사용). 보류·완료·휴지통 칩 뷰는 카드 스타일만 통일(기존 컴포넌트 유지).

`InboxTree`(트리+DnD)는 `/inbox`에서 더 이상 사용하지 않는다. 컴포넌트 파일은 삭제하지 않고 남기되(Task 10에서 참고), import만 제거한다.

**Files:**
- Modify: `src/app/inbox/page.tsx` (InboxTree 렌더를 평면 리스트로 교체, 새 ISSUE/뷰/필터 등 기존 기능 유지)

- [ ] **Step 1: 평면 리스트용 파생 데이터 + 펼침 state 추가** — `src/app/inbox/page.tsx`. 트리 대신 top-level TASK만 최신순으로 정렬하고, 부모별 sub-task와 ISSUE 이름을 맵으로 만든다. `editingTaskId` state 근처(약 72행)에 펼침 state를 추가한다.
  먼저 state 추가(약 72행 `const [editingTaskId, ...]` 다음):
  ```tsx
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
    const toggleSubs = (id: string) =>
      setExpandedSubs(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
  ```
  그리고 `treeFilteredTasks` useMemo 다음(약 327행 이후)에 평면 리스트 파생값을 추가한다.
  ```tsx
    // 평면 리스트 (spec 1): top-level TASK만 최신순. sub-TASK는 부모 토글로만 노출.
    const issuesById = useMemo(() => {
      const m = new Map<string, Issue>();
      for (const i of issues) m.set(i.id, i);
      return m;
    }, [issues]);
    const subsByParent = useMemo(() => {
      const m = new Map<string, Task[]>();
      for (const t of treeFilteredTasks) {
        if (!t.parent_task_id || t.is_deleted) continue;
        const arr = m.get(t.parent_task_id) ?? [];
        arr.push(t);
        m.set(t.parent_task_id, arr);
      }
      for (const arr of m.values()) arr.sort((a, b) => a.position - b.position);
      return m;
    }, [treeFilteredTasks]);
    const flatTopTasks = useMemo(() => {
      const base = applyBaseFilter(treeFilteredTasks)
        .filter(t => !t.parent_task_id && !t.is_deleted)
        .filter(t => isTaskDone(t.status) === showCompleted);
      return base.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [applyBaseFilter, treeFilteredTasks, showCompleted]);
    const issueChipFor = (t: Task) =>
      t.issue_id ? (() => { const i = issuesById.get(t.issue_id!); return i ? { id: i.id, name: i.name } : null; })() : null;
  ```

- [ ] **Step 2: 평면 리스트 렌더 헬퍼 추가** — 같은 파일, `taskHandlers` 정의(약 402행) 다음에 한 TASK + (펼쳐졌으면) 그 sub들을 렌더하는 헬퍼를 추가한다.
  ```tsx
    const renderFlatTask = (t: Task) => {
      const subs = subsByParent.get(t.id) ?? [];
      const expanded = expandedSubs.has(t.id);
      return (
        <div key={t.id}>
          <TaskCard
            task={t}
            {...taskHandlers}
            issueChip={issueChipFor(t)}
            subCount={subs.length}
            subsExpanded={expanded}
            onToggleSubs={() => toggleSubs(t.id)}
            editing={editingTaskId === t.id}
            onCloseEdit={closeEdit}
          />
          {expanded && subs.length > 0 && (
            <div className="ml-6 pl-3 border-l-2 border-border/60 divide-y divide-border">
              {subs.map(s => (
                <TaskCard
                  key={s.id}
                  task={s}
                  {...taskHandlers}
                  isSubtask
                  editing={editingTaskId === s.id}
                  onCloseEdit={closeEdit}
                />
              ))}
            </div>
          )}
        </div>
      );
    };
  ```

- [ ] **Step 3: 메인 리스트 분기를 평면 리스트로 교체** — 같은 파일, 메인 리스트 영역에서 `showCompleted ? (...) : treeVisibleCount === 0 ? (<EmptyState .../>) : (<InboxTree .../>)` 분기(약 643~696행)를 평면 리스트로 바꾼다. 완료 칩(showCompleted)도 동일한 `flatTopTasks`를 쓰므로 분기를 단순화한다.
  변경 후:
  ```tsx
          {flatTopTasks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={
                debouncedSearch
                  ? '검색 결과가 없어요'
                  : showCompleted ? '완료한 task가 없어요' : '인박스가 비었어요'
              }
              description={
                debouncedSearch
                  ? '검색어를 바꿔보거나 필터를 초기화해 보세요.'
                  : showCompleted
                    ? '등록된 task를 완료하면 여기에 모여요.'
                    : '위 입력창에 한 줄로 적기만 해도 task가 생겨요.'
              }
              action={
                showCompleted
                  ? undefined
                  : { label: '새 task 등록하기', onClick: () => captureRef.current?.focus() }
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {flatTopTasks.map(renderFlatTask)}
            </div>
          )}
  ```

- [ ] **Step 4: 헤더 카운트를 flatTopTasks 기준으로** — 같은 파일, 리스트 헤더의 카운트 뱃지(약 614~616행)를 평면 리스트 길이로 바꾼다.
  변경 전:
  ```tsx
            <span className="text-[12px] font-medium text-muted-foreground tabular-nums px-1.5 h-5 inline-flex items-center rounded-md bg-muted/70">
              {showCompleted ? completedTasks.length : treeVisibleCount}
            </span>
  ```
  변경 후:
  ```tsx
            <span className="text-[12px] font-medium text-muted-foreground tabular-nums px-1.5 h-5 inline-flex items-center rounded-md bg-muted/70">
              {flatTopTasks.length}
            </span>
  ```

- [ ] **Step 5: 미사용 코드·import 제거** — 같은 파일에서 평면화로 더 이상 쓰지 않는 것들을 정리한다:
  - `import { InboxTree } from '@/components/inbox/inbox-tree';` 삭제
  - `import { buildTree, filterIncomplete } from '@/lib/hierarchy';` 삭제
  - `treeFilteredTasks`는 필터에 계속 쓰므로 유지. 단 `treeVisibleCount` useMemo(약 347~354행)·`completedTasks` useMemo(약 417~423행)가 더 이상 참조되지 않으면 삭제.
  - `handleToggleSortMode`(약 189~202행)는 InboxTree 전용이었으므로 삭제. 단 `onToggleSortMode` prop을 넘기던 자리도 함께 사라진다(Step 3에서 InboxTree 제거됨).
  - `InboxTree`에 넘기던 `onMutate`/`setIssues`/`setTasks`/`onPendIssue`/`onEditIssue`/`onDeleteIssue` 콜백 중, 새 ISSUE 추가/편집/삭제 다이얼로그(`addingIssue`/`editingIssue`/`deletingIssue`)에서 여전히 쓰는 것은 유지하고, 트리에서만 쓰던 `handlePendIssue`가 미참조면 삭제.
  - 빌드·린트가 미사용을 잡아주므로, lint 에러가 가리키는 항목만 정확히 제거할 것.

- [ ] **Step 6: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러. 그다음 dev 서버를 백그라운드로 띄우고 라우트 확인:
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && (npm run dev >/tmp/wid-dev.log 2>&1 &) ; sleep 8 ; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/inbox
  ```
  기대: `200`. 확인 후 dev 서버 종료(`pkill -f "next dev" || true`).

- [ ] **Step 7: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/app/inbox/page.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: /inbox 평평한 리스트 — 트리·드래그 제거, 최신순, sub 접힘 토글

- ISSUE 그룹핑·트리 들여쓰기 제거, top-level TASK만 created_at desc
- sub-TASK는 부모 카드 ↳ sub N 토글로 그 자리 펼침
- InboxTree(DnD) 제거. 보류/완료/휴지통 칩 뷰는 카드 스타일만 통일

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 6: /today 카드 스타일 통일

`/today`는 이미 사실상 평면 forest다. Task 4의 두 줄 카드가 `TaskBranch` 경유로 그대로 적용되므로 추가 작업은 작다. ISSUE 칩이 Today 카드에도 뜨도록 root TASK에 `issueChip`을 전달하고(breadcrumb과 중복되지 않게 정리), sub N 토글은 Today의 기존 forest 펼침(TaskBranch chevron)과 충돌하지 않게 둔다.

Today는 `TaskBranch`를 쓰고 sub-TASK가 이미 forest 자식으로 렌더되므로, 카드의 `subCount`/`onToggleSubs`(자체 펼침)는 **넘기지 않는다**(이중 펼침 방지). 대신 출처 아이콘·두 줄 메타·ISSUE 칩만 통일한다.

**Files:**
- Modify: `src/components/tasks/task-branch.tsx` (TaskCard에 issueChip 전달용 prop 추가 + 전달)
- Modify: `src/app/today/page.tsx` (root TaskBranch에 issueChip 전달)

- [ ] **Step 1: TaskBranch에 issueChip prop 추가** — `src/components/tasks/task-branch.tsx` `interface Props`에 추가(약 52행 `reasonBadge?: 'deadline';` 다음).
  ```tsx
    /** 카드 2행에 표시할 소속 ISSUE 칩. 평면 리스트/Today에서 root에만 설정.
     *  recursion으로 전파하지 않는다(자식은 부모를 통해 ISSUE에 속하므로). */
    issueChip?: { id: string; name: string } | null;
  ```
  함수 구조분해(약 219행 `reasonBadge,` 다음)에 `issueChip,` 추가.

- [ ] **Step 2: TaskBranch → TaskCard로 issueChip 전달** — 같은 파일, `<TaskCard ... reasonBadge={reasonBadge} />`(약 346~359행)에 `issueChip={issueChip}`를 추가한다. recursion으로 자식 TaskBranch를 렌더하는 두 곳(`renderChildren`)에는 `issueChip`을 넘기지 않는다(전파 금지 — 자식은 ISSUE 칩 없음).
  변경 후(해당 TaskCard 호출):
  ```tsx
            <TaskCard
              task={node.task}
              onStatusChange={handleStatusChange}
              onComplete={handleComplete}
              onDelete={onDelete}
              onSelect={onSelect}
              onPend={onPend}
              isSubtask={!!node.task.parent_task_id}
              hasChildren={hasChildren}
              editing={editingTaskId === node.task.id}
              onCloseEdit={onCloseEdit}
              breadcrumb={breadcrumb}
              reasonBadge={reasonBadge}
              issueChip={issueChip}
            />
  ```

- [ ] **Step 3: Today에서 root에 issueChip 전달** — `src/app/today/page.tsx`. `buildBreadcrumb`는 이미 issueName을 계산한다. 옆에 issueChip(id+name)을 만드는 헬퍼를 추가한다(`buildBreadcrumb` 다음, 약 289행).
  ```tsx
    const buildIssueChip = (task: Task) => {
      // top-level TASK만 ISSUE 칩을 가진다(sub-TASK는 부모를 통해 연결).
      if (task.parent_task_id || !task.issue_id) return null;
      const i = issuesById.get(task.issue_id);
      return i ? { id: i.id, name: i.name } : null;
    };
  ```
  그리고 root를 렌더하는 `<TaskBranch ... breadcrumb={buildBreadcrumb(root.task)} ...>`(약 510~526행)에 `issueChip={buildIssueChip(root.task)}`를 추가한다.

- [ ] **Step 4: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러. dev로 /today 확인:
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && (npm run dev >/tmp/wid-dev.log 2>&1 &) ; sleep 8 ; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/today ; pkill -f "next dev" || true
  ```
  기대: `200`.

- [ ] **Step 5: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/components/tasks/task-branch.tsx src/app/today/page.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: /today 카드 스타일 통일 — 두 줄 카드 + ISSUE 칩

- TaskBranch에 issueChip prop 추가(root에만, recursion 전파 안 함)
- Today root TASK에 소속 ISSUE 칩 노출

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 7: 본문 폭 720px

콘텐츠 컬럼을 `max-width 720px` 중앙 정렬로 통일한다(오늘/전체/이슈/돌아보기 공통). `layout.tsx`의 `<main>` 내부 래퍼에 적용한다.

**Files:**
- Modify: `src/app/layout.tsx` (main 내부 div 약 74행)

- [ ] **Step 1: 본문 래퍼에 max-width 적용** — `src/app/layout.tsx`. 변경 전:
  ```tsx
              <main id="main-content" className="flex-1 overflow-y-auto">
                <div className="px-4 md:px-6 py-4 md:py-6 animate-fade-in">
                  {children}
                </div>
              </main>
  ```
  변경 후(720px 중앙 정렬 — 콘텐츠 컬럼만 좁히고 스크롤 영역은 유지):
  ```tsx
              <main id="main-content" className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[720px] px-4 md:px-6 py-4 md:py-6 animate-fade-in">
                  {children}
                </div>
              </main>
  ```

- [ ] **Step 2: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0.

- [ ] **Step 3: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/app/layout.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: 본문 콘텐츠 폭 720px 중앙 정렬 (모든 페이지 공통)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 8: 사이드바 메뉴 4개 (이슈 추가)

사이드바 메뉴를 오늘 · 전체 · **이슈**(신규) · 돌아보기 4개로 만든다. 이슈 메뉴 아이콘은 lucide `Folder`. 하단 설정 톱니는 그대로.

**Files:**
- Modify: `src/lib/nav-items.ts` (이슈 항목 추가)

- [ ] **Step 1: nav-items에 이슈 추가** — `src/lib/nav-items.ts`. 변경 전:
  ```ts
  import {
    Inbox,
    Sun,
    History,
  } from 'lucide-react';
  import type { LucideIcon } from 'lucide-react';

  export type NavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
  };

  // IA 단순화 (spec 2026-06-03): 메뉴 3개. 보류함·휴지통은 /inbox 보기 칩으로,
  // 설정은 사이드바 하단 톱니바퀴로 흡수.
  export const navItems: NavItem[] = [
    { href: '/today', label: '오늘', icon: Sun },
    { href: '/inbox', label: '전체', icon: Inbox },
    { href: '/history', label: '돌아보기', icon: History },
  ];
  ```
  변경 후:
  ```ts
  import {
    Inbox,
    Sun,
    History,
    Folder,
  } from 'lucide-react';
  import type { LucideIcon } from 'lucide-react';

  export type NavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
  };

  // 메뉴 4개 (spec 2026-06-03 평평한 리스트·이슈 페이지): 오늘·전체·이슈·돌아보기.
  // 보류함·휴지통은 /inbox 보기 칩으로, 설정은 사이드바 하단 톱니바퀴로 흡수.
  export const navItems: NavItem[] = [
    { href: '/today', label: '오늘', icon: Sun },
    { href: '/inbox', label: '전체', icon: Inbox },
    { href: '/issues', label: '이슈', icon: Folder },
    { href: '/history', label: '돌아보기', icon: History },
  ];
  ```
  (`sidebar.tsx`는 `navItems`를 map으로 렌더하고 active 판정이 `pathname.startsWith(item.href)`라 자동 동작한다. 단 `/issues`가 `/inbox`와 겹치지 않으므로 추가 가드 불필요. 인박스 카운트 뱃지는 `item.label === '전체'` 조건이라 이슈 메뉴엔 안 붙음 — 의도된 동작.)

- [ ] **Step 2: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build
  ```
  기대: exit 0. (`/issues` 페이지는 Task 9에서 생성되므로 이 시점엔 메뉴만 추가됨 — 링크 클릭 시 404는 Task 9 완료 후 해소. 빌드에는 영향 없음.)

- [ ] **Step 3: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/lib/nav-items.ts
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: 사이드바 메뉴 4개 — 이슈(Folder) 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 9: /issues 목록 페이지 신규 (컴팩트 리스트 + 진행바)

`/issues` 목록 페이지를 신설한다. 한 줄에 이슈 하나: `📁 이름` + 미니 진행바(키컬러) + `완료 n/m`(tabular-nums) + 임박 마감(있으면). 진행률 = 그 이슈 직속+하위 TASK 중 완료 비율(취소는 분모 제외). 완료된 이슈(모든 task 종결)는 목록 아래로 가라앉고 흐리게. 행 클릭 → 상세. 정렬: 진행 중 우선 → 임박 마감순 → 최신순.

**Files:**
- Create: `src/app/issues/page.tsx`

- [ ] **Step 1: /issues 목록 페이지 작성** — `src/app/issues/page.tsx`. 진행률은 `/api/issues/[id]/tasks`가 직속+하위를 모두 반환하므로 전체 task를 한 번에 받아 issue별로 집계한다(`/api/tasks?deleted=false` + `/api/issues`).
  ```tsx
  'use client';

  import { useEffect, useMemo, useState } from 'react';
  import Link from 'next/link';
  import { Issue, Task, isTaskDone } from '@/lib/types';
  import { apiFetch } from '@/lib/api';
  import { EmptyState } from '@/components/ui/empty-state';
  import { cn, formatDate } from '@/lib/utils';
  import { Folder } from 'lucide-react';

  interface IssueStat {
    issue: Issue;
    total: number;   // 분모: 취소 제외한 직속+하위 TASK
    done: number;    // 완료 수
    allDone: boolean; // 모든 task가 종결(완료/취소) → 목록 하단으로 가라앉음
    pct: number;
  }

  export default function IssuesListPage() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      (async () => {
        try {
          const [i, t] = await Promise.all([
            apiFetch<Issue[]>('/api/issues', { suppressToast: true }),
            apiFetch<Task[]>('/api/tasks?deleted=false', { suppressToast: true }),
          ]);
          setIssues(i);
          setTasks(t);
        } catch {} finally {
          setLoading(false);
        }
      })();
    }, []);

    const stats = useMemo<IssueStat[]>(() => {
      // issue_id로 직속+하위 TASK를 모은다. sub-TASK도 부모를 통해 같은 issue_id를
      // 직접 들고 있지 않을 수 있으므로, 부모의 issue_id를 따라가 집계한다.
      const byId = new Map<string, Task>();
      for (const t of tasks) byId.set(t.id, t);
      const resolveIssueId = (t: Task): string | null => {
        if (t.issue_id) return t.issue_id;
        if (t.parent_task_id) {
          const p = byId.get(t.parent_task_id);
          return p?.issue_id ?? null;
        }
        return null;
      };
      const grouped = new Map<string, Task[]>();
      for (const t of tasks) {
        const iid = resolveIssueId(t);
        if (!iid) continue;
        const arr = grouped.get(iid) ?? [];
        arr.push(t);
        grouped.set(iid, arr);
      }
      const result: IssueStat[] = issues.map(issue => {
        const list = grouped.get(issue.id) ?? [];
        // 분모에서 취소 제외. 완료만 분자.
        const denom = list.filter(t => t.status !== '취소');
        const done = denom.filter(t => isTaskDone(t.status)).length;
        const total = denom.length;
        const allDone = list.length > 0 && list.every(t => isTaskDone(t.status));
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { issue, total, done, allDone, pct };
      });
      // 정렬: 진행 중 우선 → 임박 마감순(마감 있는 것 먼저, 빠른 날짜 우선) → 최신순.
      return result.sort((a, b) => {
        if (a.allDone !== b.allDone) return a.allDone ? 1 : -1;
        const ad = a.issue.deadline, bd = b.issue.deadline;
        if (ad && bd && ad !== bd) return ad < bd ? -1 : 1;
        if (ad && !bd) return -1;
        if (!ad && bd) return 1;
        return b.issue.created_at.localeCompare(a.issue.created_at);
      });
    }, [issues, tasks]);

    if (loading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />)}
        </div>
      );
    }

    if (stats.length === 0) {
      return (
        <EmptyState
          icon={Folder}
          title="아직 ISSUE가 없어요"
          description="task를 ISSUE에 연결하면 여기서 묶음으로 모아볼 수 있어요."
        />
      );
    }

    return (
      <div className="space-y-1">
        <h1 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground mb-3">이슈</h1>
        <ul className="divide-y divide-border">
          {stats.map(({ issue, total, done, allDone, pct }) => (
            <li key={issue.id}>
              <Link
                href={`/issues/${issue.id}`}
                className={cn(
                  'flex items-center gap-3 px-1 py-2.5 rounded-md hover:bg-accent/30 active:bg-accent/40 transition-colors',
                  allDone && 'opacity-50',
                )}
              >
                <Folder className="h-4 w-4 text-primary flex-shrink-0" aria-hidden />
                <span className="flex-1 min-w-0 truncate text-[14px] font-medium tracking-[-0.01em]">
                  {issue.name}
                </span>
                {issue.deadline && (
                  <span className="text-[11px] text-primary tabular-nums whitespace-nowrap">
                    ⏰ {formatDate(issue.deadline, 'M월 d일')}
                  </span>
                )}
                <span
                  className="block w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`진행률 ${pct}%`}
                >
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap min-w-[42px] text-right">
                  {done}<span className="text-muted-foreground/50">/</span>{total}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  ```

- [ ] **Step 2: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러. dev로 라우트 확인:
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && (npm run dev >/tmp/wid-dev.log 2>&1 &) ; sleep 8 ; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/issues ; pkill -f "next dev" || true
  ```
  기대: `200`.

- [ ] **Step 3: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/app/issues/page.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: /issues 목록 페이지 — 컴팩트 리스트 + 진행바

- 한 줄에 이슈 하나: 이름 + 진행바 + 완료 n/m + 임박 마감
- 진행률 = 직속+하위 완료 비율(취소 분모 제외)
- 완료된 이슈는 하단으로 가라앉고 흐리게. 진행 중→마감→최신순 정렬

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 10: /issues/[id] 전면 개편 (헤더 + 다음 지목 + 드래그 reorder 유지)

이슈 상세를 목업대로 개편한다: 헤더(이름 h1 + `n/m 완료` + 큰 진행바), 그 아래 "다음: {첫 미완료 task} · 마감 {date}" 한 줄, 진행 중 목록(position 순, **드래그 reorder는 여기서만 유지** — 1-context), `+ 이 이슈에 task 추가` 인라인 입력(생성 시 issue 연결, position 맨 아래), 완료/취소 목록(아래 흐리게). 기존 편집/삭제/sort_mode 토글은 필요한 것만 이식.

드래그는 기존 `TaskBranch` + `SortableTaskItem` + `DndContext`(today/inbox에서 검증된 패턴)를 재사용한다. inbox-tree의 cross-issue·unlink·계층변경은 여기선 불필요하므로, 같은 ISSUE 내 top-level TASK reorder만 처리하는 단일 `DndContext`를 직접 둔다.

**Files:**
- Modify: `src/app/issues/[id]/page.tsx` (전면 개편)

- [ ] **Step 1: 페이지 전면 재작성** — `src/app/issues/[id]/page.tsx`. 기존 fetch/handlers(handleStatusChange/handleComplete/handleDeleteTask/patchTask)와 IssueForm/IssueDeleteDialog/ConfirmDialog 패턴을 유지하면서 레이아웃을 교체한다.
  ```tsx
  'use client';

  import { useCallback, useEffect, useMemo, useState, use } from 'react';
  import Link from 'next/link';
  import { useRouter } from 'next/navigation';
  import { Issue, Task, TaskStatus, isTaskDone } from '@/lib/types';
  import { apiFetch } from '@/lib/api';
  import { buildTree, filterIncomplete, countSubtasks } from '@/lib/hierarchy';
  import { promptNextInTodayIfNeeded } from '@/lib/today-tasks';
  import { lockedSiblings } from '@/lib/lock-state';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Separator } from '@/components/ui/separator';
  import { TaskBranch, SortableTaskItem, taskSortId } from '@/components/tasks/task-branch';
  import { IssueForm } from '@/components/issues/issue-form';
  import { IssueDeleteDialog } from '@/components/issues/issue-delete-dialog';
  import { ConfirmDialog } from '@/components/ui/confirm-dialog';
  import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
  import { ChevronLeft, Pencil, Trash2, Plus } from 'lucide-react';
  import { formatDate } from '@/lib/utils';
  import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
  } from '@dnd-kit/core';
  import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
  } from '@dnd-kit/sortable';

  export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [issue, setIssue] = useState<Issue | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmTaskDelete, setConfirmTaskDelete] = useState<string | null>(null);
    const [selectedDetailTaskId, setSelectedDetailTaskId] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    // + 이 이슈에 task 추가
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creatingTask, setCreatingTask] = useState(false);

    const fetchAll = useCallback(async () => {
      try {
        const [i, t] = await Promise.all([
          apiFetch<Issue>(`/api/issues/${id}`, { suppressToast: true }),
          apiFetch<Task[]>(`/api/issues/${id}/tasks`, { suppressToast: true }),
        ]);
        setIssue(i);
        setTasks(t);
        setNotFound(false);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => {
      const handler = () => fetchAll();
      window.addEventListener('task-updated', handler);
      window.addEventListener('task-created', handler);
      return () => {
        window.removeEventListener('task-updated', handler);
        window.removeEventListener('task-created', handler);
      };
    }, [fetchAll]);

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const totals = useMemo(() => {
      const top = tasks.filter(t => !t.is_deleted && !t.parent_task_id);
      const denomTop = top.filter(t => t.status !== '취소');
      const done = denomTop.filter(t => isTaskDone(t.status)).length;
      return {
        taskTotal: denomTop.length,
        taskDone: done,
        taskPct: denomTop.length === 0 ? 0 : Math.round((done / denomTop.length) * 100),
      };
    }, [tasks]);

    // 진행 중 / 종결 트리. buildTree로 계층을 살린 뒤 top-level 기준으로 분리.
    const { activeNodes, doneNodes, nextTask, lockedTop, subCount } = useMemo(() => {
      if (!issue) return { activeNodes: [], doneNodes: [], nextTask: null as Task | null, lockedTop: new Set<string>(), subCount: 0 };
      const built = buildTree([issue], tasks);
      const issueNode = built.issues[0];
      const all = issueNode?.tasks ?? [];
      const incompleteTree = filterIncomplete(built).issues[0]?.tasks ?? [];
      const active = incompleteTree;
      const done = all.filter(n => isTaskDone(n.task.status));
      // "다음" = position 순 첫 미완료 top-level TASK.
      const sortedActive = [...active].sort((a, b) => a.task.position - b.task.position);
      const next = sortedActive.find(n => !isTaskDone(n.task.status))?.task ?? null;
      return {
        activeNodes: sortedActive,
        doneNodes: done,
        nextTask: next,
        lockedTop: lockedSiblings(all, issue.sort_mode),
        subCount: countSubtasks(all),
      };
    }, [issue, tasks]);

    const patchTask = async (taskId: string, body: Record<string, unknown>) => {
      try {
        const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          suppressToast: true,
        });
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      } catch {
        fetchAll();
      }
    };

    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
      const before = tasks.find(t => t.id === taskId);
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: newStatus, completed_at: newStatus === '완료' ? new Date().toISOString() : t.completed_at }
          : t,
      ));
      patchTask(taskId, { status: newStatus }).then(() => {
        if (isTaskDone(newStatus) && before && !isTaskDone(before.status)) {
          promptNextInTodayIfNeeded({ ...before, status: newStatus });
        }
      });
    };

    const handleComplete = (taskId: string) => {
      const t = tasks.find(x => x.id === taskId);
      handleStatusChange(taskId, t && isTaskDone(t.status) ? '등록' : '완료');
    };

    const handleDeleteTask = async (taskId: string) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      try {
        await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      } catch {
        fetchAll();
      }
    };

    const handlers = {
      onStatusChange: handleStatusChange,
      onComplete: handleComplete,
      onDelete: (taskId: string) => setConfirmTaskDelete(taskId),
      onSelect: (taskId: string) => setSelectedDetailTaskId(taskId),
    };

    // 같은 ISSUE 내 top-level TASK reorder (1-context). 계층 변경 없음.
    const handleDragEnd = (e: DragEndEvent) => {
      const activeRaw = String(e.active.id);
      const overRaw = e.over ? String(e.over.id) : null;
      if (!overRaw || activeRaw === overRaw) return;
      const aId = activeRaw.replace('tsk:', '');
      const oId = overRaw.replace('tsk:', '');
      setTasks(prev => {
        const siblings = prev
          .filter(t => !t.is_deleted && t.issue_id === id && t.parent_task_id === null)
          .sort((a, b) => a.position - b.position);
        const oldIndex = siblings.findIndex(t => t.id === aId);
        const newIndex = siblings.findIndex(t => t.id === oId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        const posMap = new Map<string, number>();
        reordered.forEach((t, idx) => posMap.set(t.id, idx));
        const next = prev.map(t => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t);
        Promise.all(
          reordered.map((t, idx) =>
            apiFetch(`/api/tasks/${t.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ position: idx }),
              suppressToast: true,
            }),
          ),
        ).catch(() => fetchAll());
        return next;
      });
    };

    const createTask = async () => {
      const t = newTitle.trim();
      if (!t || creatingTask) return;
      setCreatingTask(true);
      try {
        // position 맨 아래 = 현재 top-level 최대 + 1.
        const tops = tasks.filter(x => !x.is_deleted && x.issue_id === id && x.parent_task_id === null);
        const nextPos = tops.reduce((m, x) => Math.max(m, x.position), -1) + 1;
        await apiFetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t, issue_id: id, parent_task_id: null, status: '등록', position: nextPos }),
          suppressToast: true,
        });
        window.dispatchEvent(new CustomEvent('task-created'));
        setNewTitle('');
        setAdding(false);
      } finally {
        setCreatingTask(false);
      }
    };

    if (loading) {
      return <div className="p-6 text-sm text-muted-foreground">ISSUE 로딩 중…</div>;
    }
    if (notFound || !issue) {
      return (
        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">존재하지 않는 ISSUE입니다.</p>
          <Link href="/issues" className="text-sm text-primary hover:underline">← 이슈 목록으로</Link>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/issues" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronLeft className="h-3 w-3" />
            이슈 목록
          </Link>
        </div>

        {editing ? (
          <IssueForm
            initial={issue}
            onSave={(updated) => { setIssue(updated); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <h1 className="text-2xl font-bold leading-tight tracking-[-0.03em] flex-1 min-w-0">
                {issue.name}
              </h1>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                편집
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                삭제
              </Button>
            </div>

            {/* n/m 완료 + 큰 진행바 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground tabular-nums">
                <span className="font-semibold text-foreground">{totals.taskDone}/{totals.taskTotal}</span>
                <span>완료</span>
                {subCount > 0 && <span className="text-muted-foreground/70">· 하위 {subCount}</span>}
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${totals.taskPct}%` }}
                />
              </div>
            </div>

            {/* 다음 지목 */}
            {nextTask && (
              <div className="text-[13px] text-foreground/90">
                <span className="text-muted-foreground">다음: </span>
                <span className="font-medium">{nextTask.title}</span>
                {nextTask.deadline && (
                  <span className="text-muted-foreground"> · 마감 {formatDate(nextTask.deadline, 'M월 d일')}</span>
                )}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* 진행 중 목록 — 드래그 reorder는 여기서만 유지 */}
        <div className="space-y-2">
          {activeNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              진행 중인 TASK가 없습니다.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={activeNodes.map(n => taskSortId(n.task.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-border">
                  {activeNodes.map(n => (
                    <SortableTaskItem key={n.task.id} id={n.task.id}>
                      {(handle) => (
                        <TaskBranch
                          node={n}
                          depth={0}
                          lockedIds={lockedTop}
                          enableSortable
                          dragHandle={handle}
                          {...handlers}
                        />
                      )}
                    </SortableTaskItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* + 이 이슈에 task 추가 */}
          {adding ? (
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); createTask(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setAdding(false); setNewTitle(''); }
                }}
                placeholder="새 TASK 제목"
                className="h-8 text-sm"
              />
              <Button type="button" size="sm" onClick={createTask} disabled={!newTitle.trim() || creatingTask} className="h-8">
                추가
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setNewTitle(''); }} className="h-8">
                취소
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/40"
            >
              <Plus className="h-3.5 w-3.5" /> 이 이슈에 task 추가
            </button>
          )}
        </div>

        {/* 완료/취소 목록 — 아래 흐리게 */}
        {doneNodes.length > 0 && (
          <div className="space-y-2 opacity-60">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">완료·취소</h2>
            <div className="divide-y divide-border">
              {doneNodes.map(n => (
                <TaskBranch
                  key={n.task.id}
                  node={n}
                  depth={0}
                  lockedIds={new Set<string>()}
                  {...handlers}
                />
              ))}
            </div>
          </div>
        )}

        <IssueDeleteDialog
          issue={deleting ? issue : null}
          taskCount={tasks.filter(t => t.issue_id === issue.id && !t.is_deleted && !t.parent_task_id).length}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); router.push('/issues'); }}
        />

        {(() => {
          const target = confirmTaskDelete ? tasks.find(t => t.id === confirmTaskDelete) : null;
          const isSub = !!target?.parent_task_id;
          return (
            <ConfirmDialog
              open={!!confirmTaskDelete}
              onOpenChange={(open) => !open && setConfirmTaskDelete(null)}
              title={isSub ? 'sub-TASK 삭제' : 'TASK 삭제'}
              description={isSub ? '이 sub-TASK를 휴지통으로 이동합니다.' : '이 TASK를 휴지통으로 이동합니다.'}
              confirmLabel="삭제"
              onConfirm={() => {
                if (confirmTaskDelete) handleDeleteTask(confirmTaskDelete);
                setConfirmTaskDelete(null);
              }}
            />
          );
        })()}

        <TaskDetailPanel
          taskId={selectedDetailTaskId}
          onClose={() => setSelectedDetailTaskId(null)}
          onTaskUpdated={fetchAll}
          onNavigate={(tid) => setSelectedDetailTaskId(tid)}
        />
      </div>
    );
  }
  ```

- [ ] **Step 2: 검증**
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러. dev로 상세 라우트 확인(이슈가 0개여도 라우트 자체는 200 또는 "존재하지 않는 ISSUE" 렌더이므로, 존재하는 id로 확인하거나 임의 id로 페이지 자체 200을 본다):
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && (npm run dev >/tmp/wid-dev.log 2>&1 &) ; sleep 8 ; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/issues/does-not-exist" ; pkill -f "next dev" || true
  ```
  기대: `200` (클라이언트 컴포넌트라 "존재하지 않는 ISSUE" 메시지를 렌더하므로 HTTP는 200).

- [ ] **Step 3: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add src/app/issues/[id]/page.tsx
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
feat: /issues/[id] 전면 개편 — 헤더·다음 지목·드래그 reorder·인라인 추가

- 헤더: 이름 h1 + n/m 완료 + 큰 진행바
- "다음: {첫 미완료 task} · 마감" 한 줄 지목
- 진행 중 목록 position 순 + 단일 DndContext reorder(계층 변경 없음)
- + 이 이슈에 task 추가(맨 아래 position). 완료/취소 목록 하단 흐리게

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 11: 문서 갱신 + 최종 build/lint 검증

architecture 문서 5종과 CLAUDE.md를 이번 변경에 맞춰 갱신하고, 신규 `issues.md`를 만든다. 마지막으로 전체 build/lint를 돌려 회귀가 없는지 확인한다.

**Files:**
- Modify: `docs/architecture/hierarchy.md` (표시 정책 — 평면 리스트에서 sub 토글, 이슈 상세/Today에서만 트리)
- Modify: `docs/architecture/dnd.md` (인박스 4-context 제거, 이슈 상세 1-context만)
- Modify: `docs/architecture/inline-editing.md` (name_locked 세팅 지점)
- Modify: `docs/architecture/today.md` (두 줄 카드·issueChip)
- Create: `docs/architecture/issues.md` (이슈 목록/상세 계약)
- Modify: `CLAUDE.md` (브랜드 아이콘 예외, 본문 폭 720px, 메뉴 4개, name_locked invariant)

- [ ] **Step 1: dnd.md 갱신** — `docs/architecture/dnd.md` 상단 요약과 SortableContext 섹션을, 인박스 DnD가 제거되고 이슈 상세 1-context만 남았다는 사실로 갱신한다. 추가할 문단(파일 맨 위 `# Drag & drop` 제목 다음에 삽입):
  ```markdown
  > **2026-06-03 변경 (평평한 리스트):** `/inbox`는 평면 리스트로 바뀌며 DnD를
  > 전부 제거했다. 드래그 reorder는 이제 **`/issues/[id]` 상세의 진행 중 목록
  > 1-context**에만 존재한다 (같은 ISSUE 내 top-level TASK reorder만, 계층 변경
  > 없음). `inbox-tree.tsx`의 4-context(ISSUE/issue내 TASK/sub/independent)와
  > cross-issue reparent·unlink·계층변경 가드는 더 이상 활성 경로가 아니다
  > (`/inbox`에서 미사용). `today/page.tsx`의 status 그룹 드래그는 그대로 유지.
  > 계층 이동 불가 invariant는 PATCH 가드(`DEPTH_FLIP` 등)로 계속 강제된다.
  ```

- [ ] **Step 2: hierarchy.md 갱신** — `docs/architecture/hierarchy.md`의 "hierarchy 배지" 섹션 아래에 표시 정책 문단을 추가한다.
  ```markdown
  ## 표시 정책 (2026-06-03 평평한 리스트)

  - `/inbox`: top-level TASK만 평면 리스트로. sub-TASK는 카드 2행 `↳ sub N`
    토글로 그 자리 펼침 — 트리 들여쓰기·`InboxTree`·`buildTree` 미사용.
  - `/issues/[id]`·`/today`: 계층 트리를 유지(`buildTree` + `TaskBranch`). 이슈
    상세에서만 드래그 reorder.
  - sub-TASK가 forest root로 올라오는 경우(Today)에도 `isSubtask`(parent_task_id
    기준) 표시는 유지.
  ```

- [ ] **Step 3: inline-editing.md 갱신** — `docs/architecture/inline-editing.md`의 "TaskInlineEditor 라이프사이클" 섹션에 name_locked 문단을 추가한다.
  ```markdown
  ## name_locked (노션 이름 보호, 2026-06-03)

  source가 `notion`인 task의 제목을 인라인 에디터·상세 패널에서 수정하면
  `name_locked: true`를 함께 PATCH한다. 이후 `/api/notion/sync`는 그 task의
  노션 제목 변경을 따르지 않는다(완료 동기화는 `notion_task_id` 매칭이라
  이름과 무관하게 동작). 다른 출처(manual/slack)는 플래그를 보내지 않는다.
  세팅 지점: `task-inline-editor.tsx` 제목 onBlur, `task-detail-panel.tsx`
  제목 onBlur.
  ```

- [ ] **Step 4: today.md 갱신** — `docs/architecture/today.md`의 "hierarchy label / breadcrumb" 섹션에 카드 스타일 한 줄을 추가한다.
  ```markdown
  ## 카드 스타일 (2026-06-03)

  Today도 두 줄 카드(출처 아이콘 + 제목 / ISSUE 칩·마감·요청자)를 공유한다.
  root top-level TASK에는 `issueChip`(id+name)을 전달해 소속 ISSUE 칩을 띄운다
  (`buildIssueChip`). sub-TASK·자식에는 전파하지 않는다. sub 펼침은 Today의
  기존 forest(TaskBranch chevron)가 담당하므로 카드의 `subCount` 토글은 Today에서
  쓰지 않는다(이중 펼침 방지).
  ```

- [ ] **Step 5: issues.md 신규 작성** — `docs/architecture/issues.md`
  ```markdown
  # 이슈 페이지 계약 (/issues, /issues/[id])

  2026-06-03 신설. ISSUE별 모아보기 — 평평한 /inbox가 잃은 "묶음 뷰"를 전담.

  ## /issues 목록

  - 데이터: `/api/issues` + `/api/tasks?deleted=false` 한 번씩 fetch 후 클라에서 집계.
  - 진행률 분모 = 그 이슈 직속+하위 TASK 중 **취소 제외**. 분자 = 완료 수.
    sub-TASK의 소속 issue는 부모의 `issue_id`를 따라 해석(`resolveIssueId`).
  - 한 줄 = `📁 이름` + 임박 마감(있으면) + 미니 진행바 + `완료 n/m`.
  - **완료된 이슈**(모든 task가 완료/취소) = 목록 하단 + `opacity-50`.
  - 정렬: 진행 중 우선 → 마감 빠른 순 → `created_at` 최신순.

  ## /issues/[id] 상세

  - 데이터: `/api/issues/[id]` + `/api/issues/[id]/tasks`(직속+하위 반환).
  - 헤더: 이름 h1 + `n/m 완료`(취소 제외 분모) + 큰 진행바.
  - "다음: {position 순 첫 미완료 top-level TASK} · 마감 {date}" 한 줄 지목.
  - 진행 중 목록: `buildTree`+`filterIncomplete`로 계층 유지, position 순.
    **드래그 reorder는 여기 1-context만** — 같은 ISSUE 내 top-level reorder,
    계층 변경 없음(`handleDragEnd`가 position만 PATCH). `TaskBranch`+`SortableTaskItem`
    재사용.
  - `+ 이 이슈에 task 추가`: `POST /api/tasks` (issue_id=현재, parent=null,
    position=현재 top-level 최대+1).
  - 완료/취소 목록: 하단 `opacity-60`.
  - 행/카드 클릭 → `TaskDetailPanel`(상세 모달). 편집/삭제 → IssueForm/IssueDeleteDialog.

  ## 관련 파일

  - `src/app/issues/page.tsx` — 목록 집계·정렬
  - `src/app/issues/[id]/page.tsx` — 상세·다음 지목·reorder·인라인 추가
  - `src/components/tasks/task-branch.tsx` — 트리 렌더 + sortable
  ```

- [ ] **Step 6: CLAUDE.md 디자인 섹션 갱신** — `CLAUDE.md`의 "디자인 시스템 v3" 섹션에 항목을 추가한다. "컬러" 항목 끝에 브랜드 아이콘 예외를, 그리고 레이아웃/사이드바 근처에 본문 폭·메뉴 4개를 반영한다. 추가할 불릿(컬러 항목 내부 또는 직후):
  ```markdown
  - **출처 브랜드 아이콘 예외** (2026-06-03): TASK 출처 식별용 브랜드 아이콘(슬랙 4색 로고, 노션 검정 N)은 "한 화면 액센트 1개" 원칙의 의도된 예외다. 브랜드 컬러는 `SourceIcon`(`src/components/tasks/source-icon.tsx`) SVG 내부에만 존재하며 표시 전용(클릭 동작 없음). WID 직접 입력은 키컬러 점, jira는 슬롯 예약(회색 점 placeholder).
  - **본문 폭** (2026-06-03): 콘텐츠 컬럼은 `max-width 720px` 중앙 정렬 (`layout.tsx` main 래퍼) — 오늘/전체/이슈/돌아보기 공통.
  - **사이드바 메뉴 4개** (2026-06-03): 오늘 · 전체 · 이슈 · 돌아보기 + 하단 설정. 이슈 아이콘 lucide `Folder`. /inbox는 평면 리스트, 묶음 뷰는 /issues가 전담.
  ```
  그리고 "코드 작성 규칙" 또는 아키텍처 참조 표에 name_locked 한 줄과 issues.md 인덱스를 추가한다(아키텍처 표에 행 추가):
  ```markdown
  | `docs/architecture/issues.md` | /issues 목록·상세 계약. 진행률 집계(취소 분모 제외), 다음 지목, 이슈 상세 1-context 드래그. |
  ```

- [ ] **Step 7: 최종 전체 검증** — 모든 task 통합 후 회귀 확인.
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && npm run build && npm run lint
  ```
  기대: build exit 0, lint 무에러. 주요 라우트 일괄 확인:
  ```bash
  cd /Users/shinhee/Desktop/Project/TOY/WID && (npm run dev >/tmp/wid-dev.log 2>&1 &) ; sleep 8 ; for p in /today /inbox /issues /history ; do printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$p"; done ; pkill -f "next dev" || true
  ```
  기대: 모두 `200`.

- [ ] **Step 8: Commit**
  ```bash
  git -C /Users/shinhee/Desktop/Project/TOY/WID add docs/architecture/hierarchy.md docs/architecture/dnd.md docs/architecture/inline-editing.md docs/architecture/today.md docs/architecture/issues.md CLAUDE.md
  git -C /Users/shinhee/Desktop/Project/TOY/WID commit -m "$(cat <<'EOF'
docs: 평평한 리스트·이슈 페이지·name_locked 반영

- dnd: 인박스 DnD 제거, 이슈 상세 1-context만
- hierarchy: 평면 리스트 표시 정책
- inline-editing: name_locked 세팅 지점
- today: 두 줄 카드·issueChip
- 신규 issues.md (이슈 페이지 계약)
- CLAUDE.md: 브랜드 아이콘 예외·본문 폭 720px·메뉴 4개

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## 실행 순서 메모

- Task 3과 Task 4는 **같은 파일**(`task-card.tsx`)을 수정한다. 순서대로 실행하고 `source-icon` import는 한 번만 둘 것.
- Task 5(평면 리스트)는 Task 4(카드 props)에 의존한다. Task 6(today)은 Task 4에 의존한다. Task 10(이슈 상세)은 Task 4·Task 9에 의존한다(목록→상세 네비). 번호 순서대로 실행하면 의존성이 충족된다.
- 마이그레이션 적용(Task 1 Step 4)은 실행자가 Supabase MCP `apply_migration`으로 수행한다.
