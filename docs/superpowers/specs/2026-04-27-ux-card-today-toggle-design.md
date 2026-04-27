# WID UX P3 — 카드 1-tap "오늘 토글"

**작성일:** 2026-04-27
**상태:** 디자인 확정, 구현 미진행
**전제:** P0 quick-capture / P1 inbox-filter / P2 inline-editor compact 완료. 카드의 가장 빈번한 보조 액션 — "오늘에 추가/제거" — 가 아직 dropdown(MoreHorizontal) 두 단계 뒤에 숨어 있음.

---

## 1. 문제 정의

지금 흐름: 카드 우측 점 3개 → 드롭다운 → "오늘에 추가". 빈도가 매우 높은 액션인데 클릭 2번 + 위치 인지 부담.

기존 인프라:
- `src/lib/today-tasks.ts` — `toggleTodayTask`, `getTodayTaskIds`, `'today-tasks-changed'` 이벤트, explicit / effective set 분리.
- `TaskCard` — 이미 `getTodayTaskIds().has(task.id)` 로 상태 추적, 이벤트 리스너 등록되어 있음 (`isTodayTask` state).
- 드롭다운 메뉴에 "오늘에 추가/제거" 항목 — `toggleTodayTask(task.id)` 호출.

이 spec은 surface 위치만 바꾼다. 토글 로직 / today set / prompt-next 동작은 그대로.

---

## 2. 범위

### In-scope (P3)

1. **TaskCard 완료 원 옆에 `Sun` 아이콘 버튼 추가** — 1-tap "오늘 토글".
2. 버튼 시각:
   - **기본 (today에 안 있음)**: 작은 sun 아이콘, opacity 약함(`30~40%`), 카드 hover 또는 버튼 자체 focus 시 100%로 강조. 클릭 후엔 채워진 상태로 유지.
   - **활성 (today에 있음)**: 채워진 노란/amber sun 아이콘 (CLAUDE.md 디자인 톤 — 모노크롬+1 accent. accent로 amber-500 사용 권장). 항상 100% opacity.
3. 클릭 시 `toggleTodayTask(task.id)` 호출. 카드 클릭(에디터 토글)으로 propagate되지 않도록 `e.stopPropagation()`.
4. 키보드: `Tab` 으로 도달 가능. `Enter` / `Space` 로 토글.
5. **드롭다운 메뉴의 "오늘에 추가/제거" 항목 제거** — 1-tap이 새 primary 진입로. 노이즈 감소.
6. 접근성: `aria-label`이 현재 상태에 따라 "오늘에 추가" / "오늘에서 제거". `aria-pressed={isTodayTask}` 로 토글 시맨틱.
7. **시각 hint (toast)**: 굳이 안 띄움 — 버튼의 시각 상태 변화(아이콘 채움/비움)가 직접 피드백. 너무 많은 toast는 노이즈.

### Out-of-scope

- prompt-next-on-complete 동작 변경 — `today.md` invariant 그대로.
- effective/explicit set 의미 변경 — 그대로 (버튼은 explicit에만 영향, descendant는 자동).
- today 페이지 자체 변경 — 그대로.
- 키보드 단축키 (`x` / `t` 등) 추가 — P4 키보드 네비 spec.
- 카드 외 surface (히스토리 detail panel 등) — 별도 spec.

---

## 3. 설계

### 3.1 위치

```
[circle] [☀] [hierarchy badge?] [title]    ...    [status ▾] [⋮]
```

- 완료 원(`Circle`/`CheckCircle2`) 바로 오른쪽, hierarchy label / 제목 앞.
- gap: `gap-3.5` 그대로 두고 sun 버튼은 `-ml-1.5` 로 약간 당겨서 원과 묶여 보이게(둘 다 "task 단위 toggle/state" 의미).

### 3.2 시각 상태

```ts
const isTodayTask = ...; // 기존 state 그대로
```

```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); toggleTodayTask(task.id); }}
  className={cn(
    'flex-shrink-0 -m-1.5 p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isTodayTask
      ? 'text-amber-500 hover:text-amber-600'
      : 'text-muted-foreground/30 group-hover/card:text-muted-foreground hover:text-amber-500',
  )}
  aria-pressed={isTodayTask}
  aria-label={isTodayTask ? '오늘에서 제거' : '오늘에 추가'}
  title={isTodayTask ? '오늘에서 제거' : '오늘에 추가'}
>
  <Sun className={cn('h-[16px] w-[16px]', isTodayTask && 'fill-amber-400')} />
</button>
```

- `group-hover/card:text-muted-foreground` — 카드 자체 hover 시 ghost 상태에서 muted까지만 강조 (full color는 버튼 hover일 때).
- `fill-amber-400` — Lucide Sun 아이콘에 fill 적용해 "켜진" 시각.
- `text-amber-500` — amber 톤 1 accent. 모노크롬 베이스에 자연스럽게 들어감. (CLAUDE.md "쨍한 색 / MVP 느낌 싫어함" 룰 — amber-500은 차분한 톤이라 OK. "쨍한" 변종 amber-400 fill은 active일 때만.)

### 3.3 드롭다운 메뉴 정리

기존 `task-card.tsx` 의 DropdownMenu 안:

```tsx
<DropdownMenuItem onClick={...toggleTodayTask...}>
  <Sun className="h-4 w-4 mr-2" />
  {isTodayTask ? '오늘에서 제거' : '오늘에 추가'}
</DropdownMenuItem>
```

→ **삭제**. 1-tap 버튼이 대체.

남는 메뉴 항목:
- `위임`
- `삭제`
- `Slack 보기` (조건부)

`UserPlus` import는 위임에서 사용 중이라 유지. `Sun` import는 1-tap 버튼이 사용하므로 유지.

### 3.4 카드 group className

기존 카드는 `group/card` 가 클래스에 안 박혀 있을 수 있음 (확인 필요). 만약 없으면 `cn` 첫 인자에 추가:

```diff
- 'group/card relative bg-card border border-border/60 ...'
+ 'group/card relative bg-card border border-border/60 ...'
```

(이미 있는지 확인 후 적절히 처리. 보통 `group` 만 있고 named group이 없으면 `group/card` 추가.)

### 3.5 모바일

hover 못 함. 결정: **default opacity를 모바일에서도 30%로 유지**. amber 활성 상태는 시각적으로 드러남. 비활성 상태도 opacity 30% 가 충분히 클릭 가능 (hit area는 `p-1.5` 로 충분).

### 3.6 prompt-next 와의 관계

- 사용자가 1-tap으로 task A를 오늘에 추가 → A의 status는 변하지 않음 → `promptNextInTodayIfNeeded` 미발동. 정상.
- 사용자가 카드의 완료 원을 눌러 A를 완료 → status='완료' → 기존 흐름대로 prompt-next 발동 (A가 explicit set에 있을 때만).
- 두 액션이 독립이므로 본 spec은 prompt-next 변경 안 함.

---

## 4. 변경 파일 목록

### 수정

- `src/components/tasks/task-card.tsx`:
  - 완료 원 직후에 1-tap Sun 버튼 추가.
  - DropdownMenu 의 "오늘에 추가/제거" 항목 제거.
  - 카드에 `group/card` named group 추가 (이미 있으면 noop).

### 신규 / 삭제

없음.

---

## 5. API / 데이터

기존 그대로. localStorage `wid-today-task-ids` 키 / `'today-tasks-changed'` 이벤트.

---

## 6. 키보드 매핑

| 키 | 컨텍스트 | 동작 |
|---|---|---|
| `Tab` | 카드 focus | 완료 원 → ☀ 버튼 → 제목 → 상태 → 점3개 순으로 이동. |
| `Enter` / `Space` | ☀ 버튼 focus | 토글. |
| `Enter` | 카드 자체 focus (☀ 외) | 기존 동일 — 인라인 에디터 토글. |

새 글로벌 단축키 추가 없음.

---

## 7. 엣지 케이스 / 결정 사항

1. **이미 effective today set에 들어와 있는 sub-TASK** (부모가 오늘에 있어서 자동 포함): explicit set에는 없음. ☀ 버튼은 **비활성 (회색)** 으로 표시. 클릭 시 explicit에 추가 (effective에는 이미 있어도 명시적 표시). 이 동작은 today set의 explicit/effective 분리 invariant 와 일치.
   - **trade-off**: "이미 today에 보임"인데 버튼이 회색이라 사용자가 헷갈릴 수 있음. 그러나 정확한 정보(부모 따라 자동인지 vs 명시 추가인지)는 explicit 표시가 맞음. 사용자가 부모에서 빼면 sub도 같이 사라지는 것을 명확히.
   - 후속 P4 후보: effective인데 explicit이 아니면 ☀ 옅은 amber 톤(half-opacity amber)으로 "자동 포함됨" 시각 차별화 — 본 spec은 단순히 explicit 기준으로만 active 표시.
2. **completed task의 ☀ 버튼**: 클릭 가능하게 둠. 완료된 task를 오늘 set에 넣거나 빼는 행위에 의미는 적지만 막을 이유도 없음.
3. **삭제된 task**: TaskCard가 렌더되지 않으므로 N/A.
4. **연속 클릭(rapid)**: localStorage 동기 쓰기라 충돌 위험 없음. 이벤트가 즉시 발화 → 상태 즉시 갱신.
5. **다른 탭(window)에서 토글**: localStorage 변경되지만 `'today-tasks-changed'`는 같은 탭에서만. 다른 탭은 별도 storage 이벤트 처리 안 함 — 기존 동작 그대로 유지(별도 spec 사항 아님).
6. **focus-visible ring**: 기존 카드의 ring과 충돌 안 하도록 sun 버튼은 `rounded-full + ring-2 ring-ring`. 시각 검증 필요.
7. **a11y**: `aria-pressed` 사용으로 스크린 리더에 토글 시맨틱 전달.

---

## 8. 비동작 (해서는 안 되는 것)

1. **today set explicit/effective 의미 변경 금지**. `getTodayTaskIds`/`getEffectiveTodayTaskIds` 동작 그대로.
2. **prompt-next-on-complete 호출 위치 변경 금지**.
3. **카드 클릭 시맨틱(=인라인 에디터 토글) 변경 금지**. ☀ 클릭이 카드 클릭으로 propagate되지 않도록 stopPropagation.
4. **toast 추가 금지** (시각 상태 변화로 충분).
5. **Sun 아이콘 외 다른 위치(예: 헤더, 별도 panel)에 토글 surface 추가 금지** — 본 spec은 카드 내 1-tap 만.
6. **DropdownMenu 다른 항목(위임/삭제/Slack)을 같이 정리하지 않는다**. 본 spec은 "오늘에 추가/제거" 항목만 제거.
7. **today 페이지 카드 표시 변경 금지** (today 페이지에서도 같은 카드 컴포넌트 — 자동으로 활성 ☀ 표시되어 자연스러움).

---

## 9. 성공 기준 (Acceptance criteria)

1. **1-tap 추가**: 임의 인박스 카드에서 ☀ 버튼 클릭 → 즉시 채워진 amber 톤. 카드 클릭 시맨틱(에디터 펼침)은 발화 안 됨.
2. **1-tap 제거**: 활성 ☀ 클릭 → 즉시 비활성 톤. today set에서 빠짐. /today 페이지로 이동하면 사라져 있음.
3. **드롭다운 정리**: 점3개 메뉴 안에 "오늘에 추가/제거" 항목 없음. "위임 / 삭제 / Slack 보기"만 남음.
4. **prompt-next 미회귀**: ISSUE 자식 task A를 오늘에 추가(☀) → 완료(완료 원) → 다음 sibling B 가 있고 effective today에 없으면 prompt-next 토스트 발동. (P0 시점부터의 동작 그대로.)
5. **부모 따라 자동 포함된 sub-TASK**: 부모를 오늘에 추가 → today 페이지에서 sub들이 보임. 그러나 sub의 ☀ 버튼은 비활성(회색) 그대로 — explicit이 아니므로. spec §7-1 결정 그대로.
6. **모바일 hover 없는 환경**: ☀ 버튼이 항상 30% opacity로 보이며 클릭 가능. 활성 시 amber 정상 표시.
7. **TypeScript / lint**: `npx tsc --noEmit -p .` 통과. `npm run lint` 기존 경고/오류 외 신규 0.

---

## 10. 참조 문서

- `docs/architecture/today.md` — explicit / effective set, prompt-next-on-complete invariant.
- `docs/superpowers/specs/2026-04-26-ux-quick-capture-design.md` — chip / amber 톤이 처음 도입된 P0.
- `CLAUDE.md` — 디자인 선호 (모노크롬+1 accent, MVP 톤 회피).

---

## 11. 후속 P4 후보 (별도 spec)

- **effective-but-not-explicit 시각 차별화** — sub-TASK가 부모 따라 자동 포함된 상태를 ☀ 옅은 amber 또는 outline-only 형태로 표시.
- **키보드 단축키 `x` / `t`** — 카드 focus 시 한 키로 완료/오늘 토글. P4 키보드 네비 spec.
- **bulk select** — 여러 카드 선택 후 한 번에 오늘에 추가/제거.
- **today 페이지 자체 카드 표시** — 부모 따라 자동 포함된 sub의 시각 차별화 동시 작업.
