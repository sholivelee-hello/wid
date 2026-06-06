# 모바일 최적화 1단계 구현 플랜 (스크롤 버그 + 터치 타겟 + ⋯ 메뉴)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폰에서 task 목록 스크롤이 되고, 버튼이 한 번에 눌리고, 우클릭 없이 모든 액션에 닿는 "폰으로 쓸 수는 있는" 상태로 만든 뒤 배포한다.

**Architecture:** 전부 CSS·컴포넌트 레벨 변경 — JS 미디어쿼리 훅 없이 Tailwind v4.2 `pointer-coarse:` variant와 CSS `@utility`로 해결. 드래그는 grip(activator)에서만 시작되므로 grip을 터치 기기에서 숨기면 드래그 비활성화가 공짜로 따라온다. ⋯ 메뉴는 기존 ContextMenu 항목을 데이터가 아닌 **render 함수 공유**로 DropdownMenu와 이중 렌더.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4.2.2 (`pointer-coarse:`/`touch-none` 내장), shadcn/ui(base-ui) ContextMenu·DropdownMenu·Tabs, @dnd-kit.

**Spec:** `docs/superpowers/specs/2026-06-06-mobile-optimization-design.md` (1단계 ①②③)

**테스트 방침:** 이 레포에는 테스트 러너가 없다(package.json에 jest/vitest/playwright 없음). 프로젝트 검증 컨벤션은 `npm run build` exit 0 + `npm run lint` 신규 문제 0 + 수동 확인(데스크톱 회귀 / Chrome DevTools 터치 에뮬레이션)이다. 각 Task의 검증 스텝이 이를 따른다. 새 테스트 프레임워크를 도입하지 말 것.

**수동 확인 공통 방법:** `npm run dev` 실행 → Chrome DevTools(⌘⌥I) → Device Toolbar(⌘⇧M) → iPhone 14 Pro 선택. 터치 에뮬레이션 상태가 `pointer: coarse`를 켠다. 데스크톱 확인은 Device Toolbar를 끄고 한다.

---

### Task 1: 스크롤 버그 수정 — touchAction을 행에서 grip으로 이동 + 터치에서 grip 숨김

**Files:**
- Modify: `src/components/tasks/task-branch.tsx:74-118` (DragHandle, SortableTaskItem)
- Modify: `src/components/inbox/inbox-tree.tsx:150-166` (SortableIssueRow style + grip)
- Modify: `src/app/inbox/page.tsx:570-582` (평면 리스트 grip)
- Modify: `src/app/today/page.tsx:563-576` (status 그룹 grip)

배경: `touchAction: 'none'`이 sortable **행 전체**에 걸려 있어 터치 스크롤이 죽는다. dnd-kit 권장은 activator(grip)에만 거는 것. grip은 4곳 전부 `setActivatorNodeRef`+listeners를 받는 전용 버튼이므로, 행에서 떼고 grip에 `touch-none`(Tailwind 내장 = `touch-action: none`)을 붙인다. 동시에 `pointer-coarse:hidden`으로 터치 기기에서 grip을 숨겨 "폰에서 순서 변경 포기" 결정을 구현한다 (grip이 없으면 드래그 시작점이 없으므로 센서 코드는 손대지 않는다).

- [ ] **Step 1: task-branch.tsx — SortableTaskItem 행 스타일에서 touchAction 제거**

`src/components/tasks/task-branch.tsx` 107-112행:

```tsx
// BEFORE
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

// AFTER — touchAction은 행이 아니라 DragHandle(activator)에만 (모바일 spec ①).
// 행 전체에 걸면 터치 스크롤이 전부 죽는다 (2026-06-06 사용자 보고 버그).
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
```

- [ ] **Step 2: task-branch.tsx — DragHandle에 touch-none + pointer-coarse:hidden 추가**

74-88행 `DragHandle`의 `className`(83행) 맨 앞에 두 클래스 추가:

```tsx
// BEFORE
      className="mt-3 p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

// AFTER — touch-none: 하이브리드(터치+마우스) 기기에서 grip 위 손가락 드래그가
// 스크롤로 새지 않게. pointer-coarse:hidden: 터치 전용 기기에선 reorder 미지원
// (spec 결정 — 폰에서 순서 변경 포기).
      className="touch-none pointer-coarse:hidden mt-3 p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
```

- [ ] **Step 3: inbox-tree.tsx — SortableIssueRow 동일 처리**

`src/components/inbox/inbox-tree.tsx` 150-155행 style에서 `touchAction: 'none',` 줄 삭제 (Step 1과 동일 패턴 + 동일 주석). 이어서 156-167행 grip 버튼 `className` 맨 앞에 `touch-none pointer-coarse:hidden ` 추가 (Step 2와 동일 패턴):

```tsx
// AFTER (grip 버튼)
      className="touch-none pointer-coarse:hidden p-1 -m-1 rounded text-muted-foreground/60 opacity-30 group-hover/issue-row:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-accent/50 cursor-grab active:cursor-grabbing flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
```

(원본 클래스 나열이 위와 다르면 — `flex-shrink-0` 포함 — 원본을 유지하고 맨 앞에 두 클래스만 추가한다.)

- [ ] **Step 4: inbox/page.tsx — 평면 리스트 grip(579행) 동일 처리**

`className` 맨 앞에 `touch-none pointer-coarse:hidden ` 추가. 이 파일의 행 wrapper에는 touchAction이 없으므로 삭제할 것은 없음.

- [ ] **Step 5: today/page.tsx — status 그룹 grip(573행) 동일 처리**

`className` 맨 앞에 `touch-none pointer-coarse:hidden ` 추가. `SortableStatusSection`(92-96행) style에는 touchAction이 원래 없음 — 건드리지 않는다.

- [ ] **Step 6: 빌드·린트**

Run: `npm run build && npm run lint`
Expected: build exit 0, lint 신규 경고/에러 0

- [ ] **Step 7: 수동 확인**

`npm run dev` →
1. 데스크톱(Device Toolbar OFF): /inbox·/today·/issues/[아무 이슈]에서 마우스로 grip 드래그 → 순서 변경 정상.
2. 터치(Device Toolbar ON, iPhone 14 Pro): /inbox·/today에서 **목록 위를 드래그해 위아래 스크롤 정상** (버그 수정 핵심), grip 안 보임.

- [ ] **Step 8: 커밋**

```bash
git add src/components/tasks/task-branch.tsx src/components/inbox/inbox-tree.tsx src/app/inbox/page.tsx src/app/today/page.tsx
git commit -m "fix: 터치 스크롤 복원 — touchAction을 행에서 grip으로 이동, 터치 기기 grip 숨김 (모바일 spec ①)"
```

---

### Task 2: 터치 타겟 44px — touch-hitarea 유틸리티

**Files:**
- Modify: `src/app/globals.css` (파일 끝에 @utility 추가)
- Modify: `src/components/ui/button.tsx:7` (cva base)
- Modify: `src/components/ui/tabs.tsx:60-61` (TabsTrigger)
- Modify: `src/components/tasks/task-card.tsx:307,475` (완료 토글, sub 토글)

배경: 시각 크기는 디자인 시스템 v3 그대로 두고, `pointer: coarse`에서만 투명 오버레이로 히트 영역을 44×44px 보장한다. **반드시 `::before`를 쓴다** — TabsTrigger가 이미 `::after`를 활성 탭 밑줄로 쓰고 있어 `::after`면 충돌한다.

- [ ] **Step 1: globals.css 끝에 유틸리티 추가**

`src/app/globals.css` 파일 맨 끝(329행 뒤)에 추가:

```css
/* 터치 히트 영역 확장 — 시각 크기는 그대로, pointer:coarse(터치)에서만
 * ::before 투명 오버레이로 누를 수 있는 영역을 최소 44×44px 보장.
 * ::after가 아닌 이유: TabsTrigger가 ::after를 활성 밑줄로 이미 사용.
 * (모바일 최적화 spec 2026-06-06 ②) */
@utility touch-hitarea {
  @media (pointer: coarse) {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: max(100%, 44px);
      height: max(100%, 44px);
      transform: translate(-50%, -50%);
    }
  }
}
```

- [ ] **Step 2: Button 전체에 적용**

`src/components/ui/button.tsx` 7행 cva base 문자열 맨 앞에 `touch-hitarea ` 추가:

```tsx
// BEFORE
  "group/button inline-flex shrink-0 items-center justify-center ..."
// AFTER (나머지 문자열은 그대로)
  "touch-hitarea group/button inline-flex shrink-0 items-center justify-center ..."
```

헤더 아이콘(32px), 상세 패널 xs 버튼(24px) 등 모든 Button이 터치에서 44px 히트 영역을 얻는다.

- [ ] **Step 3: 보기 칩(TabsTrigger)에 적용**

`src/components/ui/tabs.tsx` 60행 `cn(`의 **첫 번째 인자 앞에** 새 문자열 인자 추가:

```tsx
      className={cn(
        "touch-hitarea",
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center ...",  // 기존 그대로
        ...
```

- [ ] **Step 4: TaskCard 완료 토글에 적용**

`src/components/tasks/task-card.tsx` 307행 완료 토글 버튼 cn 첫 문자열 맨 앞에 `touch-hitarea ` 추가:

```tsx
// BEFORE
                  'flex-shrink-0 -m-1.5 mt-[1px] p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
// AFTER
                  'touch-hitarea flex-shrink-0 -m-1.5 mt-[1px] p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
```

- [ ] **Step 5: TaskCard sub 토글(`↳ sub N`)에 적용**

`src/components/tasks/task-card.tsx` 475행 sub 토글 버튼 className 맨 앞에 `touch-hitarea ` 추가:

```tsx
// AFTER
                    className="touch-hitarea inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
```

- [ ] **Step 6: 빌드·린트**

Run: `npm run build && npm run lint`
Expected: exit 0, 신규 문제 0. (`touch-hitarea`가 Tailwind에 인식 안 되면 @utility 문법/위치 확인 — v4는 top-level `@utility`만 허용)

- [ ] **Step 7: 수동 확인**

1. 데스크톱: 시각 변화 0 (버튼·칩·동그라미 크기 그대로).
2. 터치 에뮬레이션: DevTools에서 완료 동그라미 요소 검사 → `::before` 오버레이가 44×44 이상인지 확인. 동그라미 주변 ~13px 바깥을 탭해도 완료 토글 동작(상세 모달이 열리면 안 됨 — 히트 영역 우선순위 확인).
3. 헤더 펼치기/접기 아이콘, /inbox 보기 칩 탭 정상.

- [ ] **Step 8: 커밋**

```bash
git add src/app/globals.css src/components/ui/button.tsx src/components/ui/tabs.tsx src/components/tasks/task-card.tsx
git commit -m "feat: 터치 히트 영역 44px 보장 — touch-hitarea 유틸리티 (시각 크기 불변, 모바일 spec ②)"
```

---

### Task 3: "⋯ 더보기" 버튼 — 우클릭 메뉴를 터치에서 발견 가능하게

**Files:**
- Modify: `src/components/tasks/task-card.tsx` (메뉴 render 함수 공유 + ⋯ 트리거 추가)

배경: 이슈 연결·상태 변경·보류·삭제가 ContextMenu(우클릭)에만 있어 터치에서 발견 불가. 같은 항목을 DropdownMenu로도 렌더하는 **render 함수 공유** 방식 — 메뉴 항목 정의는 한 곳, 프리미티브(ContextMenu*/DropdownMenu*)만 주입.

- [ ] **Step 1: import 추가**

`src/components/tasks/task-card.tsx` 상단 import에 추가:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
```

lucide import(24-37행)에 `MoreHorizontal` 추가.

- [ ] **Step 2: MenuKit 타입 + 두 킷 정의 (컴포넌트 밖, 파일 상단)**

TaskCardProps interface 위에 추가:

```tsx
/** 우클릭(ContextMenu)과 ⋯ 버튼(DropdownMenu)이 같은 액션 목록을 렌더하기
 *  위한 프리미티브 주입 킷. 항목 정의는 renderActionItems 한 곳에만 둔다 —
 *  모바일엔 우클릭이 없어 ⋯ 입구가 필요 (모바일 spec ③, 2026-06-06). */
interface MenuKit {
  Item: React.ComponentType<{
    disabled?: boolean;
    variant?: 'destructive';
    onClick?: () => void;
    children: React.ReactNode;
  }>;
  Separator: React.ComponentType;
  Sub: React.ComponentType<{ children: React.ReactNode }>;
  SubTrigger: React.ComponentType<{ children: React.ReactNode }>;
  SubContent: React.ComponentType<{ className?: string; children: React.ReactNode }>;
}

// 실제 컴포넌트들은 MenuKit보다 넓은 props를 받으므로 구조적으로 호환 — cast로 고정.
const CTX_KIT = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
} as unknown as MenuKit;

const DD_KIT = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
} as unknown as MenuKit;
```

- [ ] **Step 3: contextMenuContent(142-267행)를 render 함수로 변환**

기존 `const contextMenuContent = (<ContextMenuContent>...</ContextMenuContent>);` 블록을 아래로 교체. **항목 내용·순서·가드 조건은 기존과 동일** — `ContextMenuItem` → `M.Item`, `ContextMenuSub` → `M.Sub`, `ContextMenuSubTrigger` → `M.SubTrigger`, `ContextMenuSubContent` → `M.SubContent`, `ContextMenuSeparator` → `M.Separator`로 치환만 한다:

```tsx
  const renderActionItems = (M: MenuKit) => (
    <>
      {openUrl && (
        <>
          <M.Item onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink />
            원본 열기
          </M.Item>
          <M.Separator />
        </>
      )}
      <M.Item
        disabled={completeBlocked}
        onClick={() => {
          if (completeBlocked) return;
          setCompletePulse((p) => p + 1);
          onComplete?.(task.id);
        }}
      >
        {isDone ? (
          <Circle className="text-muted-foreground" />
        ) : (
          <CheckCircle2 className="text-primary" />
        )}
        {isDone ? '완료 취소' : '완료'}
      </M.Item>
      <M.Item onClick={() => { toggleTodayTask(task.id); }}>
        <Sun className={cn(isTodayTask && 'fill-primary text-primary')} />
        {isTodayTask ? '오늘에서 빼기' : '오늘로 보내기'}
      </M.Item>

      {/* 하위 task 추가 — 3-level invariant상 top-level TASK에서만 (기존 동일) */}
      {!task.parent_task_id && (
        <M.Item onClick={() => setAddingSub(true)}>
          <Plus />
          하위 task 추가
        </M.Item>
      )}

      {onStatusChange && (
        <M.Sub>
          <M.SubTrigger>
            <ListChecks />
            상태 변경
          </M.SubTrigger>
          <M.SubContent>
            {TASK_STATUSES.map((s) => {
              const Icon = STATUS_ICONS[s];
              return (
                <M.Item key={s} onClick={() => onStatusChange?.(task.id, s)}>
                  {Icon && <Icon className="text-muted-foreground" />}
                  {s}
                </M.Item>
              );
            })}
          </M.SubContent>
        </M.Sub>
      )}

      {linkableIssues && onLinkIssue && !isSubtask && !task.parent_task_id && (
        <M.Sub>
          <M.SubTrigger>
            <FolderOpen />
            ISSUE에 연결
          </M.SubTrigger>
          <M.SubContent className="max-h-[320px] overflow-y-auto">
            {linkableIssues.length === 0 ? (
              <M.Item disabled>활성 ISSUE가 없어요</M.Item>
            ) : (
              linkableIssues.map((iss) => {
                const linked = task.issue_id === iss.id;
                return (
                  <M.Item key={iss.id} onClick={() => onLinkIssue(task.id, iss.id)}>
                    {linked ? (
                      <Check className="text-primary" />
                    ) : (
                      <FolderOpen className="text-muted-foreground" />
                    )}
                    <span className="whitespace-normal break-words">{iss.name}</span>
                  </M.Item>
                );
              })
            )}
            {task.issue_id && (
              <>
                <M.Separator />
                <M.Item onClick={() => onLinkIssue(task.id, null)}>연결 해제</M.Item>
              </>
            )}
          </M.SubContent>
        </M.Sub>
      )}

      {onPend && (
        <M.Item onClick={() => onPend(task.id)}>
          <PauseCircle />
          보류
        </M.Item>
      )}

      {onDelete && (
        <>
          <M.Separator />
          <M.Item variant="destructive" onClick={() => onDelete(task.id)}>
            <Trash2 />
            휴지통으로 이동
          </M.Item>
        </>
      )}
    </>
  );

  const contextMenuContent = (
    <ContextMenuContent>{renderActionItems(CTX_KIT)}</ContextMenuContent>
  );
```

키 주의: `<M.Item key=...>` — map 안의 key는 그대로 유지된다.

- [ ] **Step 4: ⋯ 트리거를 카드 행에 추가**

카드의 `flex items-start gap-3` 행(297행) 안, Title+metadata `div`(364-483행) **닫는 태그 바로 뒤**에 추가:

```tsx
          {/* ⋯ 더보기 — 터치엔 우클릭이 없으므로 같은 액션의 보이는 입구.
            * 마우스: hover 시 노출(기존 hover 언어), 터치: 상시 저채도.
            * 인라인 에디터 중에는 우클릭 메뉴와 동일하게 숨긴다. */}
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="task 액션 메뉴"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={cn(
                  'touch-hitarea flex-shrink-0 -m-1 p-1 mt-[1px] rounded text-muted-foreground/60',
                  'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-60',
                  'hover:bg-muted hover:text-foreground transition-opacity',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {renderActionItems(DD_KIT)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
```

`onClick`/`onKeyDown` stopPropagation 필수 — 카드 자체가 클릭(상세 열기)·Enter 핸들러를 갖고 있다.

- [ ] **Step 5: 빌드·린트**

Run: `npm run build && npm run lint`
Expected: exit 0, 신규 문제 0. (MenuKit cast 관련 TS 에러가 나면 `as unknown as MenuKit` 캐스트가 두 킷 모두에 있는지 확인)

- [ ] **Step 6: 수동 확인**

1. 데스크톱: 우클릭 메뉴 기존과 동일 항목·동작. hover 시 ⋯ 나타나고 클릭 → 같은 메뉴. ⋯ 클릭이 상세 모달을 열지 않음.
2. 터치 에뮬레이션: ⋯ 항상 보임(저채도) → 탭 → 메뉴에서 보류·삭제·ISSUE에 연결·상태 변경 동작. 서브메뉴(상태 변경)가 터치로 열리는지 확인.
3. /today·/inbox·/issues/[id]·휴지통 각 화면에서 ⋯ 항목 구성이 화면별 핸들러에 맞게 나오는지 (보류 없는 화면엔 보류 항목 없음 등).

- [ ] **Step 7: 커밋**

```bash
git add src/components/tasks/task-card.tsx
git commit -m "feat: 카드 ⋯ 더보기 메뉴 — 우클릭 액션을 터치에서 발견 가능하게 (render 함수 공유, 모바일 spec ③)"
```

---

### Task 4: 문서 갱신 + 최종 검증

**Files:**
- Modify: `docs/architecture/dnd.md` (모바일 정책 추가)

- [ ] **Step 1: dnd.md에 모바일 정책 섹션 추가**

`docs/architecture/dnd.md` 파일 끝에 추가:

```markdown
## 모바일(터치) 정책 (2026-06-06)

- **폰에서 순서 변경은 지원하지 않는다** (사용자 결정 — spec `2026-06-06-mobile-optimization-design.md`). 구현은 grip 숨김 한 가지: 모든 grip 버튼에 `pointer-coarse:hidden`. 드래그는 activator(grip)에서만 시작되므로 센서·DndContext는 건드리지 않는다.
- **`touchAction: 'none'`을 sortable 행 전체에 걸지 말 것** — 터치 스크롤이 전부 죽는다(2026-06-06 버그). grip 버튼의 `touch-none` 클래스로만 건다. 새 sortable을 추가할 때 이 규칙을 지킬 것.
- grip 4곳: `task-branch.tsx` DragHandle, `inbox-tree.tsx` issue grip, `inbox/page.tsx` 평면 리스트 grip, `today/page.tsx` status 그룹 grip — 모두 `touch-none pointer-coarse:hidden`.
```

- [ ] **Step 2: 최종 빌드·린트**

Run: `npm run build && npm run lint`
Expected: exit 0, 신규 문제 0

- [ ] **Step 3: 데스크톱 회귀 최종 체크리스트** (Device Toolbar OFF)

- /inbox: grip 드래그 reorder, 우클릭 메뉴, 카드 클릭 → 상세 모달, 보기 칩 전환
- /today: 그룹·개별 드래그, 완료 토글 + prompt-next 토스트
- /issues/[id]: 이슈 상세 드래그
- 시각 회귀 0: 버튼·칩 크기 변화 없음

- [ ] **Step 4: 커밋**

```bash
git add docs/architecture/dnd.md
git commit -m "docs: dnd.md 모바일 정책 — 폰 reorder 미지원, touchAction은 grip에만"
```

- [ ] **Step 5: 배포 (사용자 확인 후 — CLAUDE.md 배포 프로세스 준수)**

1. `git status` clean 확인
2. 사용자에게 master 병합 여부 확인 (현재 브랜치 feat/issue-task-hierarchy)
3. 병합 후: `npm run build` + `npm run lint` 재확인 → master push (Vercel 자동 배포)
4. prod(wid-teal.vercel.app) 주요 라우트 200 확인 + **사용자 폰 실기기 체크리스트** 전달:
   - 전체/오늘/이슈 상세에서 위아래 스크롤 정상?
   - 완료 동그라미 한 번에 눌림?
   - ⋯ 메뉴로 보류·삭제·ISSUE 연결 가능?
   - grip 손잡이 안 보임?

---

## Self-Review 결과

- **Spec 커버리지**: 1단계 ①(Task 1) ②(Task 2) ③(Task 3) 모두 매핑. 2단계 ④~⑦은 별도 플랜(1단계 실기기 피드백 후 작성).
- **Placeholder**: 없음 — 모든 스텝에 실제 코드/명령 포함.
- **타입 일관성**: MenuKit·CTX_KIT·DD_KIT·renderActionItems 명칭 Task 3 내 일관. touch-hitarea 클래스명 Task 2 정의 = Task 3 사용 일치.
