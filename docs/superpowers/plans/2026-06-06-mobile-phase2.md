# 모바일 최적화 2단계 구현 플랜 (탭바·바텀시트·스와이프·돌아보기)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 구현 에이전트는 각 Task의 대상 파일을 직접 읽고 기존 패턴에 맞춰 구현한다 (1단계와 달리 코드 전문이 아닌 계약 수준 명세 — 사용자 지시로 당일 일괄 진행).

**Goal:** 폰에서 WID가 "제대로 좋은" 모바일 앱처럼 동작 — 탭바 내비, 바텀시트 상세, 스와이프 처리, 읽을 수 있는 돌아보기. 완료 후 prod 배포까지 (사용자 지시 2026-06-06).

**Architecture:** 레이아웃 분기 = 뷰포트(`lg` 탭바·돌아보기, `sm` 바텀시트), 인터랙션 분기 = 포인터 능력(`pointer: coarse`). 데스크톱 시각·동작 회귀 0 원칙. 신규 의존성은 vaul(shadcn Drawer) 1개만.

**Tech Stack:** Next.js 16, Tailwind v4.2.2, shadcn/ui(base-ui), vaul(신규), 기존 touch-hitarea 유틸리티(1단계).

**Spec:** `docs/superpowers/specs/2026-06-06-mobile-optimization-design.md` 2단계 ④~⑦
**선행:** 1단계 완료 (4b3fb3d, 88d1170, 9063416, d7ab675, 5234394)
**검증 공통:** `npm run build` exit 0 + `npm run lint` 신규 0 + DevTools 터치 에뮬레이션. 테스트 러너 없음 — 도입 금지.

---

### Task 5: 하단 탭바 + FAB + 모바일 헤더 정리 (spec ④)

**Files:**
- Create: `src/components/layout/mobile-tab-bar.tsx`
- Modify: `src/app/layout.tsx`, `src/components/layout/header.tsx`

- [ ] **MobileTabBar 신규 컴포넌트** ('use client'):
  - `lg:hidden fixed bottom-0 inset-x-0 z-40` + `border-t border-border bg-background/95 backdrop-blur-md`
  - 탭 4개 = `navItems`(`src/lib/nav-items.ts`) 순서 그대로. 각 탭: 아이콘(h-5 w-5) + 라벨(text-[10px]) 세로 스택, `flex-1`, 높이 `h-14`, 활성(usePathname().startsWith) = `text-primary`, 비활성 = `text-muted-foreground`. 사이드바와 같은 디자인 언어 — 새 색 금지.
  - 하단 safe area: nav 요소에 `pb-[env(safe-area-inset-bottom)]`
  - **FAB**: 같은 컴포넌트에서 렌더 — `fixed right-4 z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`, `size-12 rounded-full bg-primary text-primary-foreground shadow-lg`, Plus 아이콘, `aria-label="새 task 추가"`, onClick = `useQuickCapture().openModal`. `/settings`에서는 FAB 숨김(헤더의 기존 규칙과 동일).
- [ ] **layout.tsx**: `<MobileTabBar />`를 QuickCaptureProvider 안, `</div>`(flex h-screen) 뒤에 추가. `<main>`에 모바일 하단 패딩: `pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0` 추가 (탭바에 콘텐츠 가림 방지).
- [ ] **header.tsx**: 햄버거 Sheet 블록 전체 삭제(탭바가 대체) + 관련 import 정리. 우측 펼치기/접기 2개 버튼과 "새 task" 버튼을 `hidden lg:flex`/`hidden lg:inline-flex`로 데스크톱 전용화. 모바일 우측에 `lg:hidden`으로 SyncButton + 설정 링크(Settings 아이콘, `/settings`) 추가 — Sheet 안에 있던 동기화·설정 접근을 잃지 않기 위함. 데스크톱 헤더는 시각 변화 0.
- [ ] 빌드·린트 → 커밋 `feat: 모바일 하단 탭바 + FAB — 햄버거 제거, 헤더 정리 (모바일 spec ④)`

### Task 6: task 상세 바텀시트 (spec ⑤)

**Files:**
- Create: `src/components/ui/drawer.tsx` (shadcn Drawer, vaul 기반)
- Create: `src/lib/use-media-query.ts`
- Modify: `src/components/tasks/task-detail-panel.tsx`, `package.json`(vaul)

- [ ] `npm install vaul` 후 shadcn Drawer 컴포넌트 추가 (`npx shadcn@latest add drawer` 또는 공식 drawer.tsx 수동 작성 — 기존 ui/*.tsx의 base-ui 스타일 컨벤션에 맞춤). **다크 토큰만 사용.**
- [ ] `use-media-query.ts`: `useSyncExternalStore` 기반 `useMediaQuery(query: string): boolean` (SSR getServerSnapshot=false). 주석: 레이아웃 분기는 뷰포트, 인터랙션 분기는 pointer — spec 기술 결정.
- [ ] **task-detail-panel.tsx**: 현재 `<Dialog><DialogContent className="!max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 gap-0">…</DialogContent></Dialog>`(318행 부근) 구조에서 **내용물을 그대로 유지**한 채 컨테이너만 분기:
  - `const isMobile = useMediaQuery('(max-width: 639px)')` (sm 미만)
  - isMobile → vaul `Drawer`(bottom) + `DrawerContent` 높이 `h-[92dvh]`, 상단 손잡이(shadcn 기본), 내부 `overflow-y-auto` 스크롤 영역 + 하단 푸터(저장/완료 버튼 영역)는 시트 하단 고정(`mt-auto` + `pb-[env(safe-area-inset-bottom)]`)
  - 데스크톱 → 기존 Dialog 그대로 (시각 회귀 0)
  - 내용 JSX는 변수/서브컴포넌트로 한 번만 정의해 두 컨테이너가 공유 (중복 금지)
  - 키보드 대응: 시트 스크롤 컨테이너에 `scroll-pb-24` + 입력 focus 시 `e.target.scrollIntoView({block:'center', behavior:'smooth'})` 위임 핸들러(onFocusCapture) 1개
- [ ] 빌드·린트 → 데스크톱 모달 회귀 확인 → 커밋 `feat: task 상세 모바일 바텀시트(vaul) — 데스크톱 Dialog 유지 (모바일 spec ⑤)`

### Task 7: 스와이프 액션 (spec ⑥)

**Files:**
- Create: `src/components/tasks/swipe-action-row.tsx`
- Modify: `src/components/tasks/task-card.tsx` (래핑 1곳)

- [ ] **SwipeActionRow** ('use client', 신규 라이브러리 금지 — 직접 구현):
  - props: `{ enabled: boolean; onSwipeComplete?: () => void; onSwipePend?: () => void; children }` — enabled=false면 children 그대로 반환(데스크톱/fine pointer 비용 0)
  - 터치 핸들러: touchstart에서 시작점 기록 → touchmove에서 **가로 의도 판정**(|dx| > |dy| 그리고 |dx| > 12px일 때만 발동, 아니면 스크롤에 양보) → row `translateX` 따라감(최대 ±50% 제한) → touchend에서 임계(`max(96px, 폭의 35%)`) 초과 시 액션 실행, 미만이면 스냅백(`transition-transform`)
  - 힌트 레이어: row 뒤에 absolute 배경 — 왼쪽 스와이프(완료) = 오른쪽에서 `bg-primary/15` + CheckCircle2, 오른쪽 스와이프(보류) = 왼쪽에서 `bg-muted` + PauseCircle. 임계 도달 시 아이콘 `text-primary`로 강조. 새 색 금지.
  - onSwipeComplete/-Pend 없는 방향은 비활성(움직이지 않음)
- [ ] **task-card.tsx 통합**: card를 `<SwipeActionRow enabled={isCoarse && !isDone && !editing} onSwipeComplete={onComplete && !completeBlocked ? () => { setCompletePulse(p=>p+1); onComplete(task.id); toast('완료 처리됨', { action: { label: '되돌리기', onClick: () => onComplete(task.id) } }); } : undefined} onSwipePend={onPend ? () => onPend(task.id) : undefined}>`로 감싼다. `isCoarse`는 `useMediaQuery('(pointer: coarse)')`(Task 6의 훅 재사용). sonner `toast` import. 완료/휴지통/보류 뷰는 isDone 또는 핸들러 부재로 자연 비활성 — 추가 분기 불필요한지 확인하고, 휴지통 뷰에서 onComplete가 전달되는 경우가 있으면 호출부에서 가드.
- [ ] 빌드·린트 → 터치 에뮬레이션으로 스와이프/스크롤 충돌 확인 → 커밋 `feat: 스와이프 액션 — 왼쪽 완료(되돌리기 토스트)·오른쪽 보류 (모바일 spec ⑥)`

### Task 8: 돌아보기 모바일 미니 달력 (spec ⑦)

**Files:**
- Create: `src/components/dashboard/mini-month-grid.tsx`
- Modify: `src/app/history/page.tsx`

- [ ] **history/page.tsx를 먼저 읽고** 기존 데이터 소스(완료 task·GCal 이벤트 집계)와 선택 날짜 상태, 우측 상세 패널 컴포넌트를 파악. 데이터 로직은 재사용 — 새 fetch 금지.
- [ ] **MiniMonthGrid**: 7열(월~일) 그리드, 셀 = 날짜 숫자(text-xs) + 밀도 점(그날 완료 task+이벤트 수: 1-2개=점1, 3-4=점2, 5+=점3, `bg-primary` h-1 w-1 rounded-full). 오늘 = `ring-1 ring-primary` 원, 선택일 = `bg-primary text-primary-foreground` 원. 날짜 탭 = 선택 콜백. 터치 타겟: 셀 `min-h-11`(달력 그리드는 셀이 곧 레이아웃이라 호스트 확장이 맞음 — touch-hitarea 오버레이 금지). month 네비는 페이지의 기존 월 상태 공유.
- [ ] **분기**: 기존 월 캘린더+패널 2단을 `hidden lg:grid`(기존 클래스에 추가)로, `lg:hidden`으로 MiniMonthGrid + 아래 "선택한 날 상세"(기존 우측 패널 컴포넌트 재사용 — 동일 props) 세로 스택. 상단 컨트롤 줄은 모바일에서 월 네비+핵심만 남기고 `hidden lg:flex` 적용(검색·칩은 데스크톱 전용 유지).
- [ ] 데스크톱 /history 시각 회귀 0 확인 → 빌드·린트 → 커밋 `feat: 돌아보기 모바일 미니 달력 + 선택일 상세 (모바일 spec ⑦)`

### Task 9: 문서 갱신 + prod 배포

**Files:**
- Create: `docs/architecture/mobile.md`
- Modify: `CLAUDE.md` (기술 스택 vaul, 레이아웃 섹션 모바일 한 줄, 아키텍처 표에 mobile.md 색인), `README.md`(의존성 vaul 한 줄 — README에 의존성 목록이 있으면)

- [ ] `docs/architecture/mobile.md`: 분기 정책(레이아웃=뷰포트 lg/sm, 인터랙션=pointer coarse), 탭바·FAB 계약, 바텀시트 분기 계약, 스와이프 계약(임계·가로 의도 판정), touch-hitarea/-y 사용 규칙, 폰 reorder 미지원(dnd.md 참조)
- [ ] CLAUDE.md 갱신 (디자인 결정 변경분만 간결히)
- [ ] 최종 `npm run build` + `npm run lint` → 전부 커밋
- [ ] **배포 (사용자 사전 승인됨 2026-06-06 — "prod 배포까지 끝내놔")**: ① `git status` clean → ② master 병합(`git checkout master && git merge feat/issue-task-hierarchy`) → ③ master에서 build+lint 재검증 → ④ `git push origin master` (+ 브랜치도 push) → ⑤ Vercel 자동 배포 확인(wid-teal.vercel.app) → ⑥ prod 주요 라우트 200 확인(/today, /inbox, /issues, /history)
