# WID UX P0 — Quick-Capture Composer

**작성일:** 2026-04-26
**상태:** 디자인 확정, 구현 미진행
**관련 진단:** 인박스 앱인데 캡처(쓰기) 1차 진입로가 사실상 없음. 매일 적는 task를 1초 안에 던져 넣는 흐름 부재가 "쓰기 편함 1도 없음"의 80%.

---

## 1. 문제 정의

WID는 1인 개인 task 인박스다. 일상 사용에서 가장 빈번한 행위는 "지금 떠오른/방금 받은 task를 인박스에 적어두기". 현재 이 흐름이 다음과 같이 깨져 있다.

1. 인박스 헤더 primary CTA는 `+ 새 ISSUE` (컨테이너 생성). 매일 적는 단위인 TASK는 primary 진입점이 없다.
2. TASK를 새로 만들려면 `EmptyState` 액션 → `/tasks/new` 풀페이지 → 9개 필드 폼 → 저장 → redirect. 페이지 전환 3번.
3. `Cmd+N` 단축키는 `docs/NEXT-SESSION.md`에 예약돼 있으나 코드에 구현되어 있지 않다 (`src/app/page.tsx:67-80`은 `Cmd+K`만 처리).
4. 결과: "회신 보내기" 한 줄 적자고 9칸짜리 폼을 쓰는 부담 → 캡처를 미루거나 외부 메모로 빠짐 → 인박스가 인박스 역할을 못 함.

이 spec은 캡처 진입점만 고친다. 다른 UX 이슈(필터 chrome 비대, 인라인 에디터 부피, 키보드 네비게이션 부재 등)는 별도 P1 spec으로 분리한다.

---

## 2. 범위

### In-scope (P0)

1. **`TaskQuickCapture` 컴포넌트 신설** — 두 표면(inline / modal) 모두 처리하는 단일 컴포넌트.
2. 인박스 페이지(`/`) 상단에 **persistent inline composer** 배치.
3. **글로벌 `Cmd+N` / `Ctrl+N` 단축키** — 인박스에서는 inline input에 focus, 다른 페이지에서는 modal open.
4. 인박스 헤더의 `+ 새 ISSUE` 버튼을 **secondary 톤으로 강등** (primary 위치 비움. inline composer 자체가 시각적 primary CTA 역할).
5. **`/tasks/new` 라우트 제거**. URL 직접 접근 시 `/`로 redirect.
6. 인박스 `EmptyState`의 액션 링크를 composer 트리거(콜백)로 교체.
7. 사이트 헤더 타이틀 매핑(`src/components/layout/header.tsx:28`)에서 `'/tasks/new'` 항목 제거.

### Out-of-scope (다른 spec에서)

- 헤더 chrome 정리 (priority/source/sort/status chip 단일 popover 통합)
- 카드 인라인 에디터 compact 모드
- 키보드 네비게이션 (`j/k`, `e`, `x` 등)
- bulk select 모드
- 카드의 "오늘에 추가" 1-tap 토글 승격
- 히스토리 페이지의 인라인 에디터 통합

---

## 3. 컴포넌트 설계

### 3.1 신규 파일

#### `src/components/tasks/task-quick-capture.tsx`

```ts
type TaskQuickCaptureProps = {
  surface: 'inline' | 'modal';
  /** modal 모드에서만: 모달이 열려 있는지 여부 */
  open?: boolean;
  /** modal 모드에서만: 닫기 콜백 */
  onClose?: () => void;
  /** 저장 성공 후 호출. 인박스 inline은 task list refetch 트리거용. */
  onCreated?: (task: Task) => void;
  /** 인박스가 ISSUE 컨텍스트(예: /issues/[id])에 있을 때 ISSUE chip을 prefill.
   *  P0 범위에서는 인박스 inline composer가 항상 `null` 또는 미전달.
   *  prop 자체는 P1(`/issues/[id]`에서 Cmd+N 시 prefill)을 위해 미리 자리만 잡아둠. */
  defaultIssueId?: string | null;
};
```

내부 상태:
- `title: string`
- `priority: '긴급' | '높음' | '보통' | '낮음'` (default `'보통'`)
- `deadline: string | null` (yyyy-MM-dd, default `null`)
- `issueId: string | null` (default `props.defaultIssueId ?? null`)
- `saving: boolean`
- `chipsTouched: boolean` — chip 값이 default에서 벗어났는지. "chip 값 유지 중" 인디케이터 표시 여부에 사용.

레이아웃:

```
┌────────────────────────────────────────────────────┐
│ ✏️  task 입력...                              ⏎    │
│  보통 ▾   📅 마감일 ▾   📁 ISSUE 연결 ▾   [초기화]   │
└────────────────────────────────────────────────────┘
```

- **input**: shadcn `Input`. placeholder `"task 추가... (Enter 저장)"`. 자동 focus는 mount 시 (modal 모드 한정). inline 모드는 page mount 시 자동 focus 안 함.
- **chip 3개**: 각각 shadcn `Popover` + 내부 컨텐츠.
  - 우선순위 chip: 라디오 4개 (`긴급 / 높음 / 보통 / 낮음`). 현재 값을 chip 라벨로 표시. default 값일 때는 "보통" 그대로 표시 (회색), 변경된 값일 때는 강조 톤.
  - 마감일 chip: shadcn `Calendar` + 빠른 옵션 버튼 ("오늘", "내일", "이번 주말", "초기화"). 라벨은 `M월 d일` 또는 "마감일 ▾".
  - ISSUE chip: 기존 `IssuePicker` 컴포넌트 재사용 (`src/components/issues/issue-picker.tsx`). 라벨은 ISSUE 이름 또는 "ISSUE 연결 ▾".
- **초기화 버튼**: `chipsTouched === true`일 때만 노출. 클릭 시 chip 모두 default로 복귀.
- **저장 버튼/표시**: input 우측에 작은 `⏎` 아이콘. 키보드 Enter로도 저장. saving 중이면 `Loader2` 스피너로 교체.

### 3.2 글로벌 단축키 + 모달 호스팅

`Cmd+N` / `Ctrl+N`을 어디서 listen할지 결정해야 한다. 인박스에서는 inline input에 focus만 주고, 다른 페이지에서는 modal을 띄워야 하므로 **앱 전역 컨텍스트**가 필요하다.

#### 신규 파일: `src/components/tasks/quick-capture-provider.tsx`

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type QuickCaptureContext = {
  /** 인박스 inline composer가 mount 시 등록한 focus 핸들러. 미등록(다른 페이지)이면 null */
  inlineFocus: (() => void) | null;
  registerInlineFocus: (fn: (() => void) | null) => void;
  /** 글로벌 모달 상태 */
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

export const QuickCaptureCtx = createContext<QuickCaptureContext | null>(null);
export function useQuickCapture() { /* ... */ }
```

- Provider는 `Cmd+N` / `Ctrl+N` 키 핸들러를 `document.addEventListener('keydown')`로 등록.
- 핸들러:
  1. **Cmd+N 무시 조건**: 이벤트 target이 **composer 자체의 input**일 때만 무시 (이미 composer에 있는데 또 트리거해봐야 의미 없음). 검색창/카드 인라인 에디터 등 다른 input에서는 **무시하지 않고 그대로 처리** — "검색하다 떠올라서 바로 캡처" 흐름을 살리기 위함.
     - 판정 방법: composer input에 `data-quick-capture-input="true"` 속성을 부여하고, 핸들러에서 `target.dataset.quickCaptureInput === 'true'`인 경우만 return.
  2. modal이 이미 열려 있으면 재-open 무시(아래 §7-5 참고).
  3. `inlineFocus`가 등록돼 있으면 그것을 호출 (인박스 페이지). modal은 안 띄움.
  4. 미등록이면 `openModal()` 호출.
- Provider 자체가 모달도 렌더 (`<TaskQuickCapture surface="modal" open={modalOpen} ... />`를 shadcn `Dialog` 안에 넣어서).

Mount 위치: `src/app/layout.tsx`의 client provider 트리 안. 기존 ThemeProvider/Toaster와 같은 레벨.

#### 인박스 inline 등록

`src/app/page.tsx`에서 `TaskQuickCapture surface="inline"`을 렌더. 컴포넌트 내부에서 `useQuickCapture()`로 `registerInlineFocus`를 호출하여 input에 focus 거는 함수를 provider에 등록하고, unmount 시 `null`로 해제한다.

### 3.3 동작 명세

#### 3.3.1 Inline (인박스 상단 persistent)

- 페이지 mount 시 자동 focus 안 함 (사용자가 페이지 진입 후 검색이나 다른 작업할 수도 있음).
- 사용자가 input에 타이핑 → `Enter` → 저장.
- 저장 성공 후:
  - input 값만 `''`로 비움.
  - chip 값(우선순위/마감/ISSUE) **유지**.
  - input에 focus 그대로.
  - 우상단 `chipsTouched === true`면 "chip 값 유지 중 [초기화]" 작은 인디케이터.
- 사용자가 `Cmd+N` 누르면 input에 focus만 주고 끝 (modal 안 띄움).
- 사용자가 input에서 `Esc` → focus blur.

#### 3.3.2 Modal (다른 페이지에서 Cmd+N)

- shadcn `Dialog` 사용. 중앙 정렬, max-width `~520px`.
- 모달 mount 시 input에 자동 focus.
- `Enter` → 저장 → 모달 자동 닫힘 → 성공 토스트 표시:
  ```
  "✓ task 추가됨"
  description: "인박스로 이동"
  action: { label: "이동", onClick: () => router.push('/') }
  ```
- `Shift+Enter` → 저장 + 모달 유지 + chip 값 유지 + input 비움 + input focus 유지 (rapid 모드).
- `Esc` → 닫기 (저장 안 함).
- 닫힘 시 모든 상태 초기화 (다음 모달 open 시 깨끗한 상태).

#### 3.3.3 새 task 위치 규칙 (양쪽 공통)

저장 시 보낼 payload:

```json
{
  "title": "...",
  "priority": "보통",
  "deadline": null,
  "issue_id": null,
  "parent_task_id": null,
  "status": "등록",
  "source": "manual",
  "position": <see below>
}
```

- **position 계산**:
  - `issue_id`가 설정돼 있으면: 해당 ISSUE의 top-level children(같은 issue_id, parent_task_id=null) 중 `min(position) - 1` (또는 0이면 모두 +1 후 새 항목 0). 실용적으로는 **`min(position) - 1`이 음수가 되어도 OK** — 정렬은 `position ASC`이므로 항상 top.
  - `issue_id`가 null이면: independents 영역(`issue_id=null`, `parent_task_id=null`) 중 `min(position) - 1`.
- mock backend 컨벤션은 `docs/architecture/mock-backend.md`의 "POST는 반드시 push" + position 할당 룰을 따른다.
- 정렬 모드(`sortBy='priority' | 'deadline' | 'created_at'`)와 무관하게 새 항목은 일단 top에 보임. 정렬은 클라이언트에서 `position`이 아닌 다른 기준일 수 있으므로 — **이 경우엔 inbox UI가 새 task 1개를 임시로 list 맨 앞에 prepend하는 visual hint**를 별도로 처리하지 않는다. `sortBy` 기본값이 `'priority'`인데 새 task의 priority가 '보통'이면 다른 '보통' task 사이에 끼게 되어 시각적 강조 약함. 이 경우 toast 자체가 시각 피드백 역할.
  - **trade-off 수용**: 정렬 시각 충돌은 P1 spec(헤더 정리)에서 "최근 추가" 정렬 옵션 추가로 해결.

### 3.4 chip 동작 디테일

#### 우선순위 chip

- popover 안에 `Button` 4개 (라디오 스타일). 선택 시 popover 닫힘.
- 라벨에 색상 점/뱃지 사용하지 않는다 (Linear/Height 톤). `긴급`만 약간 강조 (text-destructive).
- default(`'보통'`) → chip은 회색 outline.
- 변경됨(`!= '보통'`) → chip은 foreground 톤.

#### 마감일 chip

- popover 안에 빠른 옵션 4개 + `Calendar`.
  - 빠른 옵션: `오늘`, `내일`, `이번 주말 (다음 일요일)`, `초기화`.
- 라벨:
  - `null` → "마감일 ▾" 회색.
  - 오늘 → "오늘" foreground.
  - 그 외 → `M월 d일` foreground.

#### ISSUE chip

- 기존 `IssuePicker` 재사용. `<IssuePicker open={...} onClose={...} currentIssueId={issueId} onPick={setIssueId} onCreate={handleCreate} />`.
- `handleCreate`: `POST /api/issues` 호출 → 성공 시 issueId state 업데이트 + (옵션) issues 목록 refetch.
- 라벨:
  - `null` → "ISSUE 연결 ▾" 회색.
  - 설정됨 → `📁 ${issue.name}` foreground (truncate).

### 3.5 chip "유지 중" 인디케이터

```
chipsTouched = (priority !== '보통') || (deadline !== null) || (issueId !== defaultIssueId)
```

- inline: composer 우측 상단에 `text-[11px] text-muted-foreground` 작은 라벨 + "[초기화]" 텍스트 버튼.
- modal: 모달 헤더(타이틀 옆)에 동일 스타일.
- 클릭 시: priority='보통', deadline=null, issueId=defaultIssueId.

---

## 4. 변경 파일 목록

### 신규

- `src/components/tasks/task-quick-capture.tsx` — 본 spec의 컴포넌트.
- `src/components/tasks/quick-capture-provider.tsx` — provider + 글로벌 단축키 + 모달 호스팅.

### 수정

- `src/app/layout.tsx` — `<QuickCaptureProvider>`로 children 감싸기. ThemeProvider/Toaster와 동일 레벨.
- `src/app/page.tsx`:
  - 상단(filters 위)에 `<TaskQuickCapture surface="inline" onCreated={...} />` 렌더.
  - `onCreated` 콜백에서 `setTasks(prev => [newTask, ...prev])` (낙관적 업데이트) + `window.dispatchEvent(new CustomEvent('task-created'))` (기존 이벤트 활용).
  - `EmptyState`의 `action` 변경: `href: '/tasks/new'` → composer trigger 콜백(예: provider의 `inlineFocus()` 호출 또는 단순 안내문 변경).
  - `+ 새 ISSUE` Button: `variant="outline"` → `variant="ghost"`로 한 단계 더 약화. 라벨/위치는 그대로.
  - 기존 `Cmd+K` 핸들러는 그대로 유지.
- `src/components/layout/header.tsx`:
  - 28번 라인의 `'/tasks/new': '새 task',` 매핑 제거.
- `src/app/tasks/new/page.tsx`:
  - 파일 내용을 다음으로 교체:
    ```tsx
    import { redirect } from 'next/navigation';
    export default function Page() { redirect('/'); }
    ```
  - (라우트 자체를 디렉터리 째 삭제하지 않는 이유: 기존 북마크/외부 링크 보호.)

### 삭제하지 않는 것 (확인 사항)

- `src/components/tasks/task-form.tsx` — `/tasks/[id]/page.tsx`에서 task 편집용으로 재사용 중 (`grep` 결과 라인 6, 71). 그대로 유지.

---

## 5. API / 데이터

기존 엔드포인트만 사용:

- `POST /api/tasks` — 신규 task 생성. 본 spec에서 새 필드 추가 없음.
- `GET /api/issues` — ISSUE chip의 picker가 사용. 기존 그대로.
- `POST /api/issues` — ISSUE chip에서 새 ISSUE 즉석 생성 시. 기존 `IssuePicker.onCreate`가 호출.

mock backend 동작은 `docs/architecture/mock-backend.md`의 "POST는 반드시 push" 규칙을 따르며, `position` 필드를 명시적으로 보내야 top-of-list에 들어간다 (mock의 default position 할당이 last이므로 top을 원할 때는 클라이언트가 negative/min-1을 명시).

---

## 6. 키보드 매핑

| 키 | 컨텍스트 | 동작 |
|---|---|---|
| `Cmd+N` / `Ctrl+N` | 인박스 | inline input에 focus |
| `Cmd+N` / `Ctrl+N` | 그 외 페이지 | modal open + input auto-focus |
| `Cmd+N` / `Ctrl+N` | composer input 자체 focus 중 | 무시 (no-op) |
| `Cmd+N` / `Ctrl+N` | 다른 input/textarea (검색, 인라인 에디터 등) focus 중 | **그대로 처리** (인박스면 inline focus, 외부면 modal open) |
| `Enter` | composer input | 저장. inline은 input clear + chip 유지. modal은 저장 후 닫힘. |
| `Shift+Enter` | composer input | 저장 + chip 유지 + input clear + (modal이면) 모달 유지. |
| `Esc` | modal | 닫기 (저장 안 함) |
| `Esc` | inline input | blur |
| `Cmd+K` | 전역 (기존) | 검색 input focus. 변경 없음. |

---

## 7. 엣지 케이스 / 결정 사항

1. **빈 제목 저장**: trim 후 길이 0이면 저장 무시 + input 흔들기 애니메이션 등 별도 피드백 없음. 단순 noop.
2. **저장 중 추가 Enter**: `saving === true`이면 input 비활성화. 두 번째 Enter는 막힘.
3. **저장 실패**: `apiFetch`의 toast 자동 표시(suppressToast 안 씀). input 값과 chip 모두 **그대로 유지**해서 재시도 가능. saving=false로 복귀.
4. **ISSUE chip에서 새 ISSUE 즉석 생성 후 저장**: `onCreate`가 issueId state를 업데이트한 뒤, 사용자가 Enter 누르면 새 ISSUE에 첨부된 채로 task 저장. 즉, 2-step (ISSUE 생성 → task 저장)이지만 사용자에게는 1-flow.
5. **modal이 열려 있을 때 다시 `Cmd+N`**: 무시. 이미 열려 있는 모달의 input에 focus만 다시 줌.
6. **인박스 inline composer가 mount되기 전 `Cmd+N`**: provider에 `inlineFocus`가 아직 등록 안 됐으면 modal을 띄움 (race 안전망).
7. **다크모드**: shadcn `Input`/`Popover` 기본 톤 사용. chip 강조는 `text-foreground` vs `text-muted-foreground` 차이로 처리 (특정 색상 하드코딩 금지).
8. **모바일 폭(<640px)**: inline composer는 chip을 input 아래 줄로 자동 wrap. modal은 `Dialog`의 기본 모바일 동작 사용 (full-width).
9. **포커스 트랩**: modal은 shadcn Dialog가 기본 처리.
10. **`/today`, `/history`, `/issues/[id]`에서 Cmd+N**: 모두 modal로 통일. `/issues/[id]` 컨텍스트에서는 provider가 issueId를 안다면 `defaultIssueId`로 prefill하는 게 자연스러움 — 단, **이 prefill은 P0 범위 밖**으로 둔다 (provider가 페이지 컨텍스트를 알아야 해서 별도 설계 필요). P0에서는 그냥 빈 modal로 띄우고, P1에서 issue 페이지의 컨텍스트를 prop으로 provider에 주입하는 방식 추가.

---

## 8. 비동작 (해서는 안 되는 것)

1. **Linear 스타일 smart parse 도입 금지** (`!높음 @내일 #프로젝트`). 한국어 환경에서 본인이 문법을 일관되게 쓸 부담이 큼. 별도 P2/P3 후보.
2. **chip에 색상 강조 추가 금지**. CLAUDE.md의 디자인 선호: "쨍한 색/MVP 느낌 싫어함, 모노크롬+1 accent".
3. **새 floating action button (FAB) 추가 금지**. 데스크톱 위주 사용이고 시각 노이즈로 작용.
4. **기존 `EmptyState`의 다른 액션 변경 금지**. 본 spec은 `/tasks/new` 링크만 교체.
5. **`task-form.tsx` 삭제 금지**. `/tasks/[id]/page.tsx`가 사용 중.
6. **사이드바/다른 페이지에 inline composer 추가 금지**. inline은 인박스 한 곳에만.

---

## 9. 성공 기준 (Acceptance criteria)

다음 시나리오가 모두 통과해야 P0 완료로 간주한다.

1. **글로벌 캡처 속도**: 임의 페이지(`/today`, `/history`, `/issues/[id]`)에서 키보드만으로 task 1개 생성까지 3초 이내. 측정: `Cmd+N` → 제목 타이핑 → `Enter`.
2. **연속 입력 (인박스)**: 인박스에서 `Cmd+N` → 5개 task를 chip 변경 없이 연속 등록. 마우스 사용 0회. 매 항목이 인박스 list에 즉시 추가됨.
3. **rapid 모달**: 다른 페이지에서 `Cmd+N` → `Shift+Enter`로 3개 연속 등록 → `Esc`로 닫기. 매 저장 후 모달이 닫히지 않고 chip 유지.
4. **chip 유지 동작**: 우선순위를 '높음'으로 바꾼 후 task 1개 등록 → 두 번째 task 입력칸이 비어 있고 chip은 여전히 '높음' → "chip 값 유지 중" 인디케이터 노출.
5. **시각 피드백**: 새 task가 인박스 list 맨 위에 보이거나(미완료 그룹 또는 ISSUE 자식 top), 모달 케이스는 토스트의 "이동" 액션으로 인박스 진입 시 top에 노출.
6. **legacy URL**: 브라우저로 `/tasks/new` 직접 접근 → `/`로 redirect (404 없음).
7. **헤더 타이틀**: 어떤 라우트에서도 헤더 빵부스러기에 "새 task" 라벨이 나타나지 않음 (매핑 제거 확인).
8. **TypeScript / lint**: `npx tsc --noEmit -p .` 와 `npm run lint` 통과.

---

## 10. 참조 문서

- `CLAUDE.md` — 디자인 선호 (Linear/Height 모노크롬), 1인 사용 가정, mock-first 정책.
- `docs/architecture/mock-backend.md` — POST 시 push 규칙, position 할당 컨벤션.
- `docs/architecture/inline-editing.md` — 카드 인라인 에디터의 라이프사이클 (composer 저장 후 카드 클릭으로 자연스럽게 연결되는 흐름의 끝점).
- `docs/architecture/today.md` — explicit/effective today set. 본 spec은 today를 건드리지 않으나, "오늘에 추가" chip을 미래에 고려할 경우 참고.
- `docs/architecture/hierarchy.md` — ISSUE > TASK > sub-TASK depth 룰. composer는 항상 top-level TASK만 만든다 (sub-TASK 생성은 본 spec에서 다루지 않음).

---

## 11. 후속 P1 후보 (별도 spec)

본 spec 구현 후 사용해보고 필요 시 다음 spec들을 작성한다.

- **헤더 chrome 정리**: priority/source/sort/status chip → 단일 `필터 ▾` popover. "최근 추가" 정렬 옵션 추가 (정렬 시각 충돌 해결).
- **카드 인라인 에디터 compact 모드**: 첫 펼침은 4필드(제목/상태/우선순위/마감), "더 보기" 시 나머지 노출. 저장 트리거 onBlur로 통일.
- **카드 1-tap "오늘 토글"**: 완료 원 옆에 ☀ 아이콘.
- **키보드 네비게이션**: `j/k` (포커스 이동), `e` (인라인 에디터 토글), `x` (완료 토글).
- **bulk select**: 카드 hover 시 체크박스 노출, 1개 이상 선택 시 floating action bar.
- **ISSUE 페이지에서 Cmd+N 시 ISSUE chip prefill**: `/issues/[id]` 컨텍스트가 modal에 주입되도록 provider 확장.
