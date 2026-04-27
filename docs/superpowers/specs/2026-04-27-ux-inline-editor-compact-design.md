# WID UX P2 — 카드 인라인 에디터 compact 모드

**작성일:** 2026-04-27
**상태:** 디자인 확정, 구현 미진행
**전제:** P0 (`2026-04-26-ux-quick-capture`) + P1 (`2026-04-27-ux-inbox-filter-consolidation`) 구현 완료. 인박스 chrome / quick-capture 진입로는 정리됐지만 카드를 클릭해 들어가는 인라인 에디터 자체는 v2 그대로 8필드 wall. 일상 편집 (상태/우선순위/마감 한 번 바꾸는 정도)이 매 번 8필드 폼을 띄우게 함.

---

## 1. 문제 정의

`TaskInlineEditor` 현 구조 (`src/components/tasks/task-inline-editor.tsx`):

```
[인라인 편집]                       ✓ 저장됨 / 닫기
제목  [................................]
상태  [▾]            우선순위  [▾]
마감일  [date]       요청자  [...]
위임 대상  [...]
설명  [textarea 3 rows]
ISSUE  [box w/ name + 변경 / 분리]
                                              [삭제]
```

문제:

1. **세로 8필드 + ISSUE 박스 + 삭제 버튼 = 카드 펼침 시 화면의 큰 영역 점유**. 가까운 다음 task 카드들이 시야에서 밀려남.
2. **편집 빈도 분포 불균형**:
   - 자주: 제목 / 상태 / 우선순위 / 마감일 / ISSUE — 매 task 마다.
   - 가끔: 요청자 / 위임 대상 / 설명 — 만들 때 한 번 정도.
3. **자주 수정하는 4-5필드 보려고 가끔 쓰는 3필드도 항상 보임** = 노이즈 비율 높음.
4. **삭제 버튼이 항상 노출 (destructive)** — 시각 무게도 있고 오발 위험도 약간 있음.

이 spec은 인라인 에디터 한 컴포넌트의 시각 밀도만 정리한다. 카드 클릭 시맨틱(`docs/architecture/inline-editing.md`), 저장 라이프사이클(`onBlur` / `onChange` 분기), pill 표시는 모두 그대로 유지.

---

## 2. 범위

### In-scope (P2)

1. **`TaskInlineEditor` 기본 레이아웃 = compact 모드**:
   - 제목 input (그대로 유지).
   - 자주 쓰는 4 필드를 한 줄(또는 2-wrap)에 chip-style trigger로 배치: **상태** / **우선순위** / **마감일** / **ISSUE**.
   - 가끔 쓰는 3 필드(요청자 / 위임 대상 / 설명)는 기본 hidden.
   - 삭제 버튼도 기본 hidden (compact 헤더 우측 X 옆에 작은 아이콘으로 두지 않음 — 진짜 의도한 행동이어야 함).

2. **"더 보기" 토글**:
   - compact 행 아래에 `▶ 더 보기` 텍스트 버튼 (chevron). 클릭 시 ▼ 로 회전 + 가끔 필드 + 삭제 버튼 노출.
   - 토글 상태는 컴포넌트 instance state(`useState(false)`). 카드를 닫으면(`editingTaskId` 변경) state 잃음. 다음에 같은 task를 다시 펴도 기본 compact.
   - **자동 펼침 규칙**: mount 시 `task.requester || task.delegate_to || task.description` 중 하나라도 값이 있으면 → 기본 펼침. (기존 데이터를 숨기는 건 잘못된 default.)

3. **chip-style trigger 통일**: 상태/우선순위/마감일은 chip 라벨 + popover로 교체.
   - 상태 / 우선순위: shadcn `Popover` + 옵션 버튼 리스트.
   - 마감일: P0 quick-capture composer의 마감일 chip 그대로 (오늘/내일/이번 주말/초기화 + Calendar). **로직 재사용을 위해 `task-quick-capture.tsx` 의 deadline popover 부분을 별도 모듈로 추출**해 둘이 공유.
   - ISSUE chip: P0 composer와 동일 — `IssuePicker` 트리거.

4. **chip 색상 톤**: 모노크롬+1 accent 룰 그대로. default 값과 다른 chip은 `border-foreground/30 text-foreground`, default = `border-border text-muted-foreground`. 마감일 chip 라벨은 `오늘`(특수) / `M월 d일` / "마감일".

5. **삭제 버튼**: "더 보기" 펼친 상태에서만 노출. 기존 destructive variant 그대로.

### Out-of-scope

- **카드 외부**(TaskCard 헤더, 메타 line) — 본 spec 건드리지 않음. 인라인 에디터 본문 한정.
- **저장 라이프사이클 변경**: `onBlur` (텍스트) / `onChange` (셀렉트) 분기 그대로.
- **키보드 네비게이션** (Tab 순서, esc-to-close) — 별도 spec.
- **카드 1-tap "오늘 토글"** — 별도 후속 spec.
- **history/today 페이지의 detail panel** — 본 spec은 `TaskInlineEditor` (인박스/issue 상세에서 쓰는 것) 한정.
- **sub-TASK 표시**: 현재 `!task.parent_task_id` 분기로 ISSUE 섹션 숨김. 그대로 유지.
- **에디터 색상 / 보더 / 카드 nesting 시각** — 그대로.

---

## 3. 설계

### 3.1 새 레이아웃 (compact 기본)

```
┌──────────────────────────────────────────────┐
│ 인라인 편집              [✓ 저장됨] [닫기 X] │
│ [제목 input ..............................]   │
│ [상태 ▾] [긴급 ▾] [📅 4월 30일] [📁 ISSUE] │
│ ▶ 더 보기                                     │
└──────────────────────────────────────────────┘
```

- chip 줄은 `flex flex-wrap gap-1.5`. 모바일 폭에서 자연스럽게 wrap.
- ISSUE chip은 sub-TASK일 때(`task.parent_task_id != null`) 숨김.

### 3.2 펼친 상태 (more open)

```
┌──────────────────────────────────────────────┐
│ ... compact 행 ...                            │
│ ▼ 더 보기                                     │
│ 요청자 [.....................................]│
│ 위임 대상 [.................................]│
│ 설명 [textarea 3rows ........................]│
│                                       [삭제]  │
└──────────────────────────────────────────────┘
```

- 텍스트 input 3개 + textarea + 삭제 버튼. 기존 컴포넌트(`Input`, `Textarea`, `Label`, destructive `Button`) 그대로 사용.
- Label은 작은 `text-xs text-muted-foreground` 스타일 그대로.

### 3.3 chip 컴포넌트 추출

shared chip+popover 패턴을 `src/components/tasks/task-chip.tsx` (신규) 에 추출:

```ts
// task-chip.tsx
type TaskChipProps = {
  active?: boolean;       // default와 다름 → foreground 톤
  variant?: 'default' | 'destructive'; // 긴급 등 강조
  icon?: React.ReactNode; // optional leading icon
  label: string;
  trigger: 'popover' | 'click'; // popover면 children = 내용, click이면 onClick
  onClick?: () => void;
  popover?: React.ReactNode;
};
```

또는 더 단순: chip은 그냥 일관된 `<button>` 컴포넌트로 두고, popover/dialog는 부모가 결정. 이쪽이 합리적.

→ **결정**: 단순한 `TaskChipButton` 만 추출:
```ts
type TaskChipButtonProps = {
  active?: boolean;
  variant?: 'default' | 'destructive';
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
};
```
chip 모양만 통일하고, popover trigger는 각자 호출하는 곳에서. quick-capture와 inline-editor 둘 다 이걸 쓴다.

### 3.4 마감일 popover 공유

`TaskQuickCapture` 의 deadline popover (오늘/내일/이번 주말/초기화 + Calendar) 부분을 `src/components/tasks/deadline-popover.tsx` 로 추출:

```ts
type DeadlinePopoverProps = {
  value: string | null;             // yyyy-MM-dd
  onChange: (v: string | null) => void;
  triggerLabel?: string;            // "마감일" default
  triggerIcon?: boolean;            // Calendar icon 표시 default true
};
```

내부: `Popover` + 4개 빠른 버튼 + `Calendar`. trigger는 `TaskChipButton`.

`task-quick-capture.tsx` 와 `task-inline-editor.tsx` 둘 다 이 컴포넌트 사용. 변경 시 둘 다 자동 일관성.

### 3.5 상태 / 우선순위 popover

각각 `TaskChipButton` + `Popover` + 옵션 버튼 리스트.

상태:
```tsx
<Popover ...>
  <PopoverTrigger render={<TaskChipButton active={...}>{status}</TaskChipButton>} />
  <PopoverContent className="w-40 p-1">
    {TASK_STATUSES.map(s => (
      <button onClick={() => { setStatus(s); save({ status: s }); close(); }}>
        {s}
      </button>
    ))}
  </PopoverContent>
</Popover>
```

우선순위: 동일 패턴. `'긴급'` 일 때 chip variant=`destructive` (text-destructive).

기존 Select 컴포넌트 사용 안 함 — chip 톤이 인박스 / quick-capture 와 시각 일치하도록.

### 3.6 ISSUE chip

기존 코드 흐름 유지(IssuePicker open). chip 라벨:
- 미연결: `📁 ISSUE 연결` muted.
- 연결됨: `📁 {name}` truncated, max-width `~180px`.
- chip 클릭 → IssuePicker open. 해제는 picker 안에서? — 현재 picker는 onPick / onCreate만 있음. unlink 동작이 없음.
- **결정**: ISSUE chip 옆에 작은 unlink X 버튼을 두지 않는다. 대신 chip이 active일 때 chip 안 우측에 `×` 아이콘을 두고 그 영역만 클릭하면 unlink. (chip 본체 클릭 = picker open, X 영역 = unlink.) keyboard accessibility를 위해 X는 별도 `<button>`.

### 3.7 "더 보기" 토글

```ts
const hasOptional = !!(task.requester || task.delegate_to || task.description);
const [moreOpen, setMoreOpen] = useState(hasOptional);
```

- `useEffect` mount 시 한 번 — 또는 useState lazy init으로 한 번만 평가. 마운트 후 task 값 변경 시(타이핑 → 저장 → 같은 task의 다른 필드) 다시 collapse 되지 않음.
- 토글 버튼: `text-xs text-muted-foreground hover:text-foreground inline-flex gap-1`, chevron 회전.
- aria-expanded 와이어링.

### 3.8 헤더(파일럿 라인) 변경

기존:
```
[인라인 편집]    [✓ 저장됨 / 저장 중 pill]    [닫기]
```

그대로 유지. 닫기 버튼 옆에 삭제 버튼은 두지 않음 (자주 쓰지 않는 destructive 액션이라).

---

## 4. 변경 파일 목록

### 신규

- `src/components/tasks/task-chip-button.tsx` — chip 모양 button. quick-capture에서 직접 inline 작성한 chip 스타일을 추출. quick-capture도 이걸 쓰도록 교체.
- `src/components/tasks/deadline-popover.tsx` — quick-capture 의 deadline 부분 추출. quick-capture도 이걸 import.

### 수정

- `src/components/tasks/task-inline-editor.tsx` — 본 spec §3.1~§3.7 적용. compact 행 + 더 보기 토글 + chip popover. Select / 마감일 input 제거.
- `src/components/tasks/task-quick-capture.tsx` — chip / deadline popover 부분을 위 신규 모듈로 교체. 외부 동작은 그대로.

### 삭제

없음.

---

## 5. API / 데이터

신규 엔드포인트 없음. 모두 기존 `PATCH /api/tasks/{id}` 와 기존 필드 사용.

ISSUE unlink 동작도 기존 `attachToIssue(null) === unlink` 패턴 — 본 spec §3.6 chip의 X 버튼이 호출.

---

## 6. 키보드 매핑

| 키 | 컨텍스트 | 동작 |
|---|---|---|
| `Esc` | chip popover 열림 | popover 닫음 (shadcn 기본) |
| `Esc` | 인라인 에디터 input focus | (현재) 카드 클릭 핸들러까지 안 올라가도록 stopPropagation. **변경 없음.** |
| `Tab` | 에디터 내 | 자연스럽게 chip → chip → 더 보기 → (펼친 경우) 가끔 필드 → 삭제 순. |
| `Enter` | chip popover 안 옵션 버튼 | 그 옵션 선택. |

새 글로벌 단축키 추가 없음.

---

## 7. 엣지 케이스 / 결정 사항

1. **mount 시 자동 펼침**: `hasOptional` 계산은 `useState` lazy init으로 1회만. 사용자가 더 보기 후 수동 collapse 해도, requester 입력 후 blur로 저장된 다음 collapse를 유지(자동 재펼침 안 됨). (자동 collapse도 안 됨 — 사용자 의도 존중.)
2. **collapse 도중 textarea에 입력하던 값**: 더 보기 닫는 시점에 어떤 input이 focus였다면 onBlur가 발화 → save 후 hidden. 데이터 손실 없음. UX적으로는 사용자가 명시적으로 collapse 누른 거니 OK.
3. **마감일 chip 라벨 "오늘"** 표시: 현재 시각 기준 yyyy-MM-dd 와 동일하면 "오늘". 외 → `M월 d일`. quick-capture와 동일 함수 재사용 (`deadline-popover.tsx` 내부 helper).
4. **타임존**: yyyy-MM-dd 문자열로만 비교. 로컬 자정 기준(`new Date()`로 today 계산). DST/UTC 보정 안 함 — 1인 사용자 KST.
5. **ISSUE chip의 unlink X 버튼 hit area**: chip 우측 끝 작은 영역. 모바일 터치 정확도 위해 `p-0.5` 정도 hit padding 추가. e.stopPropagation으로 바깥 chip 클릭(picker open)과 분리.
6. **상태/우선순위 popover에서 같은 값 다시 클릭**: noop (저장 호출 안 함). 단순 중복 체크.
7. **`saving` / `savedAt` pill**: 그대로 동작. chip popover 안에서 옵션 클릭 → 즉시 save → pill update.
8. **sub-TASK 인라인 에디터**: ISSUE chip은 항상 hidden (`!task.parent_task_id` 가드 그대로). 나머지 4 chip 중 ISSUE 자리는 그냥 빈 칸 → 3 chip 행으로 표시.
9. **chip wrap 우선순위**: 좁은 폭에서 wrap 시 행 순서 = 상태 → 우선순위 → 마감일 → ISSUE. ISSUE가 가장 길어 마지막 줄로 떨어지기 쉬움. wrap 자체는 OK.
10. **더 보기 펼침 시 애니메이션**: shadcn `Collapsible` 사용 또는 그냥 `display: none` 토글. **결정**: 단순 conditional render. fade-in 정도만 (`animate-in fade-in-0 duration-150`). slide-down 안 함 (DOM height 깜빡임 비용).
11. **중복 추출 비용**: `task-chip-button.tsx` / `deadline-popover.tsx` 만들면서 quick-capture를 같이 손대야 함 — 외부 동작 변하지 않도록 신중하게. spec §9 #6 검증으로 확보.

---

## 8. 비동작 (해서는 안 되는 것)

1. **저장 트리거 변경 금지**. 텍스트는 onBlur, 셀렉트는 onChange — `inline-editing.md` 의 invariant.
2. **`promptNextInTodayIfNeeded` 호출 위치 변경 금지**. status='완료' 저장 직후 동일 위치에서 호출.
3. **삭제 다이얼로그(`ConfirmDialog`) 동작 변경 금지**. 삭제 버튼 위치만 옮김.
4. **카드 클릭 시맨틱 변경 금지**. 본 spec은 에디터 본문만 다룸.
5. **새 keyboard 단축키 추가 금지**. P3 키보드 네비 spec에서.
6. **history detail panel(`day-detail-panel`, `week-detail-panel`)에 본 패턴 적용 금지** — 별도 spec.
7. **chip 색상에 hard-coded hex 사용 금지**. shadcn 토큰만.

---

## 9. 성공 기준 (Acceptance criteria)

다음 시나리오가 모두 통과해야 P2 완료.

1. **초기 시각 밀도 감소**: 비어있는 task(요청자/위임/설명 모두 null)의 카드를 클릭 → 인라인 에디터가 1行 chip 행 + 더 보기 토글 only로 보임. textarea, requester input 등이 DOM에 안 보임.
2. **자동 펼침**: requester="홍길동"인 task 카드 클릭 → 마운트 시 더 보기가 이미 펼쳐져 있고 requester 값이 보임.
3. **수동 토글**: 더 보기 클릭 → 펼침. 다시 클릭 → 접힘. chevron 회전 시각.
4. **chip-popover 동작**: 상태 chip 클릭 → popover 6옵션 → '진행중' 선택 → chip 라벨 "진행중"으로 변경 + ✓ 저장됨 pill 표시. 우선순위/마감일도 동일.
5. **마감일 chip 라벨**: deadline=오늘 → chip 라벨 "오늘". 미설정 → "마감일" muted.
6. **quick-capture 미회귀**: 인박스에서 `Cmd+N` → 기존 동일하게 동작 (chip 추출 후에도 외부 동작 동일). `Shift+Enter` 연속 등록 OK.
7. **ISSUE chip unlink**: 연결된 task의 ISSUE chip 우측 X 클릭 → unlink + ✓ 저장됨 pill. chip 자체 클릭 → IssuePicker open.
8. **저장 라이프사이클**: 제목 변경 후 blur → ✓ 저장됨. requester 변경 후 blur → ✓ 저장됨. 상태 변경 즉시 → ✓ 저장됨.
9. **sub-TASK 케이스**: parent_task_id가 있는 sub-TASK 카드 클릭 → ISSUE chip 안 보임. 나머지 3 chip 보임.
10. **삭제 버튼 위치**: compact 상태에서 삭제 버튼 안 보임. 더 보기 펼침 → 우측에 삭제 버튼 보임. 클릭 → ConfirmDialog → 삭제.
11. **TypeScript / lint**: `npx tsc --noEmit -p .` 와 `npm run lint` (기존 경고/오류 무시) 통과.

---

## 10. 참조 문서

- `docs/architecture/inline-editing.md` — 카드 클릭 시맨틱, 저장 라이프사이클. **invariant 그대로 유지**.
- `docs/superpowers/specs/2026-04-26-ux-quick-capture-design.md` — chip / deadline popover 의 원본 구현. 본 spec에서 추출 후 공유.
- `docs/superpowers/specs/2026-04-27-ux-inbox-filter-consolidation-design.md` — 직전 P1. 인박스 chrome 정리와 같은 모노크롬+chip 톤.
- `CLAUDE.md` — 디자인 선호 (모노크롬+1 accent), 1인 사용 가정.

---

## 11. 후속 P3 후보 (별도 spec)

본 spec 구현 후 사용해보고 필요 시:

- **카드 1-tap "오늘 토글"** — 완료 원 옆 ☀ 아이콘. 인라인 에디터 안 펴고 오늘 추가/제거.
- **키보드 네비게이션** — `j/k`, `e`(에디터 토글), `x`(완료), `/` (검색).
- **bulk select** — hover 체크박스 + floating action bar.
- **history detail panel에 같은 compact 패턴 적용** — `day-detail-panel`, `week-detail-panel`.
- **인라인 에디터 keyboard shortcut**: 안에서 `Esc` → 에디터 닫음. (현재 stopPropagation 으로 막혀 있음.)
- **chip 컴포넌트 라이브러리화** — `task-chip-button` 을 더 일반화해 다른 페이지(today, history)에도 적용.
