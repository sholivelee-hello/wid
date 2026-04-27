# WID UX P1 — 인박스 필터 chrome 단일 popover 통합

**작성일:** 2026-04-27
**상태:** 디자인 확정, 구현 미진행
**전제:** 2026-04-26-ux-quick-capture P0 구현 완료 (`feat/issue-task-hierarchy` 브랜치).
**관련 진단:** Quick-capture composer로 캡처 1차 진입로는 해결됐지만, 그 바로 아래 인박스 헤더가 여전히 chrome 비대 — 검색 / 우선순위 select / 출처 select / 정렬 select / 상태 칩 6개 + 초기화가 한 화면에 동시 노출. 매일 쓰는 사람의 시야를 차지하는 비용 대비 사용 빈도 낮음. 또 quick-capture로 갓 추가한 task가 정렬 기본값(`우선순위`) 때문에 list 중간에 끼어 시각 피드백이 약함 — P0 spec §3.3.3에서 받아들였던 trade-off.

---

## 1. 문제 정의

현재 인박스(`/`) 상단 chrome는 다음 순서로 쌓여 있다 (P0 quick-capture 적용 후 기준).

```
┌ Quick-capture composer ──────────────────────────────┐
└──────────────────────────────────────────────────────┘
[ 검색 ⌘K ]  [우선순위 ▾]  [출처 ▾]    정렬: [우선순위 ▾]   [+ 새 ISSUE]
상태:  [등록] [진행중] [대기중] [완료] [위임] [취소]   [초기화]
```

문제:

1. **선택 컨트롤 5개가 동등 weight로 나열** — 사용자는 매일 셋팅을 바꾸지 않는다. "한 번 정해두고 쓰는" 도구가 항상 보일 필요는 없음.
2. **상태 칩 6개가 따로 한 줄을 차지** — 인박스에서 상태로 필터하는 빈도는 적음(주로 "미완료만 보기" 토글로 충분). 6칸 가로 footprint 손해.
3. **모바일 폭(<640px)에서 chrome 만으로 한 화면 절반** — 본 list 보기 전에 스크롤 필요.
4. **정렬 기본값 = 우선순위 → quick-capture 신규 task 시각 충돌** — P0 spec §3.3.3에서 명시한 trade-off. 새 task가 같은 priority의 다른 task 사이에 끼어 새 항목을 알아채기 어려움. P0 spec이 "최근 추가" 정렬 옵션 추가로 해결한다고 약속한 부분.

이 spec은 인박스 chrome 정리 + 정렬 옵션 보강만 다룬다. 카드 인라인 에디터 / 키보드 네비 / bulk select 등은 별도 P1/P2 spec.

---

## 2. 범위

### In-scope (P1)

1. **`InboxFilterPopover` 컴포넌트 신설** — 단일 `필터 ▾` 트리거 + popover. 안에 정렬 / 우선순위 / 출처 / 상태 4섹션.
2. 인박스 헤더의 다음 컨트롤 제거하고 popover로 흡수:
   - 우선순위 select
   - 출처 select
   - 정렬 select
   - 상태 칩 strip (`TASK_STATUSES.map`)
3. 인박스 헤더에 검색 + `필터 ▾` + (활성 시) 초기화 텍스트 + `+ 새 ISSUE` 4개만 남김.
4. **active filter count badge** — 우선순위/출처/상태 중 default가 아닌 차원의 개수를 `필터 (n) ▾`로 표시. (정렬은 count에서 제외 — 항상 어떤 값이든 적용되므로 "변경됨" 개념이 어색.)
5. 정렬 옵션 라벨 변경 + 기본값 변경:
   - `우선순위` (그대로) — `'priority'`
   - `마감일` (그대로) — `'deadline'`
   - `생성일` → **`최근 추가`** 라벨로 교체 — `'created_at'`
   - 새 default = `'created_at'` (`최근 추가`). 기존 `'priority'` default는 quick-capture 시각 피드백과 충돌하므로 폐기.
6. 정렬 선택을 **localStorage에 영속화** — `wid-inbox-sort` 키. 기존 `wid-inbox-filter`(상태)와 같은 패턴.
7. 헤더 외부에 작은 **"정렬: 최근 추가"** 텍스트 라벨 노출 — 어떤 정렬이 적용 중인지 popover 안 열어도 즉시 보이게. (정렬은 list 의미 자체를 바꾸므로 popover에 숨기지 않는다.)

### Out-of-scope

- `TaskFilters` 컴포넌트의 다른 페이지 사용 — 현재 `grep` 결과 인박스 외 사용처 없음(`/today`, `/history`는 자체 chrome). 컴포넌트 자체는 본 spec에서 **삭제**.
- Custom views(인박스 하단의 사용자 정의 뷰) — 별도 영역으로 그대로 유지. 본 spec은 메인 list 위 chrome 만 정리.
- "미완료만 보기" / "완료된 것도 보기" 토글 — section 헤더 옆에 있는 별개 컨트롤. 본 spec은 건드리지 않음.
- 검색 input — 자리 그대로 유지. 검색은 필터가 아니라 별 동작 (타이핑 = 실시간).
- `/today`, `/history` 의 chrome — 이번 작업 대상 아님.
- 우선순위/출처를 multi-select로 바꾸는 것 — 현 단일 select 의미 유지. (multi가 필요해지면 별 spec.)

---

## 3. 컴포넌트 설계

### 3.1 신규 파일

#### `src/components/tasks/inbox-filter-popover.tsx`

```ts
type SortKey = 'priority' | 'deadline' | 'created_at';

type InboxFilterPopoverProps = {
  sort: SortKey;
  priority: string;            // 'all' | Priority
  source: string;              // 'all' | Source
  statuses: string[];          // multi; empty = 모든 상태
  onSortChange: (v: SortKey) => void;
  onPriorityChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onStatusesChange: (v: string[]) => void;
};
```

내부 동작:
- shadcn `Popover`. 트리거는 `Button variant="outline" size="sm"`.
- 트리거 라벨:
  - default(필터 미변경) → `필터` (회색).
  - 변경됨 → `필터 (n)` (foreground). `n = (priority !== 'all' ? 1 : 0) + (source !== 'all' ? 1 : 0) + statuses.length`.
- Popover 내부 width `~280px`. 4 섹션, 각 섹션 사이 separator.

레이아웃:

```
┌──────────────────────────┐
│ 정렬                      │
│ [최근 추가 ●]             │
│ [우선순위] [마감일]        │
│ ─────                    │
│ 우선순위                   │
│ [전체] [긴급] [높음]       │
│ [보통] [낮음]              │
│ ─────                    │
│ 출처                      │
│ [전체] [WID] [notion]     │
│ [slack]                   │
│ ─────                    │
│ 상태 (다중)                │
│ [등록] [진행중] [대기중]    │
│ [완료] [위임] [취소]        │
│ ─────                    │
│             [초기화]      │
└──────────────────────────┘
```

- 각 옵션은 작은 chip 버튼 (`h-7 px-2.5 rounded-full text-[12px]`). 선택 시 채움(`bg-foreground/10 border-foreground/30 text-foreground`), 비선택은 outline + muted.
- 정렬 / 우선순위 / 출처는 single — chip 클릭 시 그 값으로 즉시 set + popover **닫지 않음** (사용자가 한 popover에서 여러 차원 조절할 수 있도록).
- 상태는 multi — chip 클릭 시 toggle. 빈 배열 = "모든 상태 통과".
- "초기화" 버튼: 우선순위='all', 출처='all', statuses=[]. 정렬은 건드리지 않음. (정렬은 사용자 의도가 비교적 명확하므로 reset 대상 외.)
- popover 닫는 방법: 외부 클릭 / Esc — shadcn `Popover` 기본 동작.

### 3.2 인박스 헤더 새 레이아웃

```tsx
<div className="flex items-center gap-3 flex-wrap">
  <div className="flex-1 min-w-0">
    {/* 검색 input — TaskFilters 의존 X */}
    <SearchInput value={search} onChange={...} />
  </div>
  <InboxFilterPopover ... />
  {filterActive && (
    <button onClick={resetAllFilters} className="text-[11px] text-muted-foreground hover:text-foreground underline">
      초기화
    </button>
  )}
  <span className="text-[11px] text-muted-foreground hidden sm:inline">
    정렬: {sortLabel}
  </span>
  <Button size="sm" variant="ghost" ... >
    <Plus className="h-3.5 w-3.5 mr-1" /> 새 ISSUE
  </Button>
</div>
```

- 검색 input은 TaskFilters의 검색 부분만 떼어내서 인박스 페이지에 직접 인라인. (TaskFilters 컴포넌트는 다른 곳에서 안 쓰이므로 별도 추상화 불필요. 헤더 페이지 내 인라인이 가장 정직.)
- "정렬: 최근 추가" 텍스트는 데스크톱 한정 노출 (모바일 footprint 절약). 모바일에서는 popover 안에서만 보임.
- `filterActive` = `priority !== 'all' || source !== 'all' || statuses.length > 0`. 정렬 변경은 active로 치지 않음 (위와 같은 이유).

### 3.3 정렬 영속화

새 헬퍼 추가 — `src/lib/custom-views.ts`:

```ts
const INBOX_SORT_KEY = 'wid-inbox-sort';

export function loadInboxSort(): SortKey {
  if (typeof window === 'undefined') return 'created_at';
  try {
    const raw = localStorage.getItem(INBOX_SORT_KEY);
    if (raw === 'priority' || raw === 'deadline' || raw === 'created_at') return raw;
  } catch {}
  return 'created_at';
}

export function saveInboxSort(v: SortKey) {
  localStorage.setItem(INBOX_SORT_KEY, v);
}
```

(타입 `SortKey` 자체는 `custom-views.ts`에 이미 union으로 존재. 필요시 export.)

`page.tsx`:
- 초기값 `useState(() => loadInboxSort())`.
- onChange 시 `saveInboxSort(v)` 동시 호출.

### 3.4 정렬이 list 그룹 빌드에 미치는 영향

현재 `InboxTree`는 ISSUE-자식 / independent 두 그룹 모두 `position` 기준으로 정렬한다 (mock backend의 `position` 컨벤션 — DnD reorder가 그 기준). **본 spec은 `InboxTree` 내부 정렬을 건드리지 않는다.** 

`sortBy` state는 다음 두 곳에만 영향:
1. `getViewTasks` — custom views 영역의 task 정렬에는 그대로 적용. (P1 단계에서 custom view마다 자체 sortBy를 가지므로, 인박스 메인 sort 변경은 사실 커스텀 뷰에 안 흘러도 됨.)
2. **신규**: `InboxTree` 내부의 같은 그룹 내 정렬 키. 단 — `InboxTree`가 DnD 가능하려면 `position` 기준이 정합성에 필수. `sortBy !== 'priority'` 같은 경우 DnD reorder가 시각상 즉시 반영되지 않을 수 있음. 

Trade-off 결정:
- **선택 A**: `sortBy`는 메인 인박스 list의 정렬에 영향 — DnD 시각 일관성을 잃을 위험. 사용자가 sort='최근 추가'로 두고 reorder하면 즉시 반영 안 보일 수 있음.
- **선택 B**: `sortBy`는 custom view에만 영향, 메인 list는 항상 `position` 기준. 그러면 헤더 sort가 "메인 list엔 영향 없음"이 되어 사용자 멘탈 모델과 어긋남.

→ **결정: 선택 A**. 이유: 현재 사용 시나리오에서 사용자는 (1) 정렬을 바꾸거나 (2) DnD로 위치를 옮기거나 둘 중 하나만 의식적으로 함. sort가 'priority'/'deadline'/'created_at' 어느 쪽이든, 같은 그룹 내에서 `position` 도 함께 사용해 stable sort로 보강한다. DnD는 같은 sort 안에서도 position만 바뀌므로 다음 paint에 그 변경이 보이려면 sort tie-breaker가 position이어야 함.

정렬 적용 방식:
```ts
function sortTasks(list, sortBy) {
  const key = (t: Task) => {
    if (sortBy === 'priority') return [PRI_ORDER[t.priority], t.position];
    if (sortBy === 'deadline')  return [t.deadline ?? '￿', t.position]; // null → 뒤
    return [-Date.parse(t.created_at), t.position]; // 최근 추가 → 음수 = 작은 = 앞
  };
  return [...list].sort((a, b) => cmpTuple(key(a), key(b)));
}
```

`InboxTree`의 issue children 정렬과 independents 정렬에 위 함수를 끼워 넣는다 — 단 **issue의 `sort_mode === 'sequential'` 인 경우는 무조건 `position` 단독 정렬** (시퀀셜 ISSUE는 차례 의미가 핵심이라 사용자 sort와 충돌해선 안 됨).

### 3.5 `TaskFilters` 컴포넌트 처리

현 `src/components/tasks/task-filters.tsx`는 인박스 외에서 사용되지 않음 (`grep` 결과). 본 spec에서 **파일 삭제**. 검색 input은 인박스 페이지에 인라인.

만약 후속에서 다른 페이지(today/history)도 같은 chrome을 도입하면 그때 다시 추출. 미리 추상화하지 않음 (지금은 1곳만 씀).

---

## 4. 변경 파일 목록

### 신규

- `src/components/tasks/inbox-filter-popover.tsx` — 본 spec §3.1 컴포넌트.

### 수정

- `src/lib/custom-views.ts`:
  - `SortKey` union을 named export(`export type SortKey = ...`).
  - `loadInboxSort` / `saveInboxSort` 헬퍼 추가, `INBOX_SORT_KEY` 상수.

- `src/app/page.tsx`:
  - `TaskFilters` import 제거.
  - `Select` import 제거 (sortBy select가 이제 popover 안으로 들어감).
  - 검색 input을 `<TaskFilters>` 자리에 직접 인라인 (icon + input + ⌘K kbd badge).
  - sortBy 초기값 `useState(() => loadInboxSort())`. setter 호출 시 `saveInboxSort` 동시 실행 — small wrapper 또는 useEffect.
  - default sortBy 'priority' → 'created_at' (영속화 저장값이 없을 때).
  - 헤더 row를 §3.2 레이아웃으로 교체.
  - 상태 칩 strip 블록 (현재 라인 ~289 ~ 319) 전부 제거.
  - `InboxFilterPopover` 호출 추가, props 와이어링.
  - `getViewTasks` 의 정렬 로직은 그대로 유지 (custom view 정렬은 view마다 sort).
  - `InboxTree`에 main sortBy를 prop으로 넘기는 것 — 아래 항목 참조.

- `src/components/inbox/inbox-tree.tsx`:
  - 새 prop `sortBy: SortKey` 받기.
  - 같은 그룹 내 정렬에 §3.4의 `sortTasks` 적용.
  - sequential ISSUE는 position 단독 정렬 유지.

### 삭제

- `src/components/tasks/task-filters.tsx`.

---

## 5. API / 데이터

신규 엔드포인트 / payload 변경 없음. 모두 클라이언트 정렬·필터 로직 변경.

localStorage 키:
- 기존 `wid-inbox-filter` (상태 chip multi) — **유지**. popover의 상태 섹션이 이 값을 read/write.
- 신규 `wid-inbox-sort` — sort key 1개 영속화.
- 기존 `wid-inbox-views` — 영향 없음.

---

## 6. 키보드 매핑

본 spec은 키보드 단축키 추가 없음. 단, 다음을 보장한다.

| 키 | 컨텍스트 | 동작 |
|---|---|---|
| `Cmd+K` | 인박스 | 검색 input focus. **변경 없음**. |
| `Cmd+N` | 인박스 | quick-capture inline focus. **변경 없음**. |
| `Esc` | popover 열림 | popover 닫음 (shadcn 기본). |

키보드 navigation (`j/k`, `e`, `x` 등)은 별도 P2 spec.

---

## 7. 엣지 케이스 / 결정 사항

1. **popover 안 chip 그룹 키보드 접근성**: shadcn `Popover` + 일반 `<button>` 조합. Tab 순회는 자연스럽게 동작. 라디오 의미가 강한 정렬/우선순위/출처는 `aria-pressed` 사용.
2. **상태 빈 배열 vs 모든 상태 선택**: 둘 다 의미상 "모든 상태 통과"이므로 빈 배열을 canonical로. 사용자가 6개 모두 선택 → 자동으로 빈 배열로 normalize 안 함 (의도적인 sticky 선택 유지).
3. **filter active count 정의**: §3.1 공식 그대로. 정렬은 count에서 제외. localStorage 부재 등으로 default값일 때 count=0.
4. **모바일(<640px)**:
   - 검색 input full-width 1행, 그 아래 `[필터 ▾]` + 초기화 + `+ 새 ISSUE`.
   - "정렬: ..." 텍스트는 모바일에서 숨김 (popover 안에서 확인).
5. **default 변경(priority → created_at)에 따른 기존 사용자 영향**: localStorage `wid-inbox-sort` 부재이면 새 default 'created_at' 적용. 사용자가 명시적으로 'priority'로 바꿔뒀다면 그대로 복원. (기존 사용자 데이터 마이그레이션 필요 없음 — 기존 sort는 영속화 안 됐었음.)
6. **`InboxTree` DnD와 sort 변경 동시**: §3.4 trade-off 그대로. sort='priority'에서 DnD하면 position 변경이 같은 priority 그룹 내 위치만 바꿈. sort='created_at'에서는 DnD 효과가 다음 reload 까지 약하게 보일 수 있음. 일단 받아들임 — 필요시 별도 spec.
7. **sequential ISSUE 자식 정렬**: 항상 `position` 단독. sortBy 무시.
8. **빈 인박스 EmptyState**: P0 spec에서 이미 callback 형태로 변경됨. 영향 없음.
9. **검색 + 필터 조합**: 검색 결과에 popover 필터가 추가로 AND 적용. 현재 `applyBaseFilter` 와 `getViewTasks` 패턴 유지.
10. **`+ 새 ISSUE` 버튼 위치**: 모든 폭에서 헤더 row 끝에 둠. 모바일에서 wrap되면 가장 마지막 줄.

---

## 8. 비동작 (해서는 안 되는 것)

1. **`TaskFilters` 컴포넌트 다른 페이지 도입 금지**. 인박스에서 떼어내며 함께 삭제.
2. **`InboxTree` 내부 DnD 정렬 기준을 `position`이 아닌 다른 키로 바꾸지 않는다**. DnD 정합성을 깨뜨림.
3. **상태 칩을 popover 밖에 다시 노출하지 않는다**. 한 곳으로 통합하는 게 본 spec의 핵심.
4. **`/today`, `/history` 의 chrome을 본 작업 중에 함께 정리하지 않는다**. 스코프 분리.
5. **우선순위/출처 select를 multi-select로 변경하지 않는다**. 현 single 의미 그대로.
6. **`Cmd+F` 같은 새 단축키 추가 금지**. 키보드 네비는 별 spec.
7. **검색 input에 디바운스 시간 변경 / 검색 알고리즘 변경 금지**. 본 spec은 chrome layout만 바꿈.

---

## 9. 성공 기준 (Acceptance criteria)

다음 시나리오가 모두 통과해야 P1 완료로 간주.

1. **Chrome footprint 축소**: 인박스 헤더 row 1줄 + (필요 시) 활성 초기화 텍스트 only. 상태 chip strip이 사라져야 함. 데스크톱 폭에서 quick-capture composer + filter row + main list 헤더 가 모두 첫 화면(스크롤 없음)에 보임.
2. **단일 popover로 4차원 조작**: `필터 ▾` 클릭 → 한 popover 안에서 정렬/우선순위/출처/상태를 모두 조작 가능. 각 변경이 main list에 즉시 반영.
3. **Active count badge**: 우선순위='긴급' + 상태=['등록','진행중'] 선택 시 트리거 라벨이 `필터 (3) ▾`. priority/source/status 모두 default일 때는 `필터 ▾` (count 없음).
4. **정렬 영속화**: '최근 추가' 선택 → 페이지 reload → 여전히 '최근 추가'. 트리거 외부 텍스트 라벨이 "정렬: 최근 추가" 표시.
5. **Quick-capture 시각 피드백 회복**: 인박스에서 `Cmd+N` → task 입력 → Enter → 새 task가 main list 맨 위(또는 ISSUE-자식 top)에 즉시 보임. (default 정렬이 '최근 추가'이므로 created_at desc로 자연스럽게 top.)
6. **DnD 정합성**: '최근 추가' 정렬 상태에서도 DnD reorder가 같은 그룹 내 position을 변경. (시각상 즉시 반영이 약할 수 있다는 trade-off는 수용.)
7. **상태 chip strip 제거 확인**: `<TASK_STATUSES.map>` 패턴이 인박스 페이지에서 사라짐. 상태 필터는 popover 안에서만 조작.
8. **모바일 폭(375px)**: 검색 + 필터 트리거 + 초기화 + 새 ISSUE 가 자연스럽게 wrap. popover 자체는 화면 폭 안에 들어감.
9. **TypeScript / lint**: `npx tsc --noEmit -p .` 와 `npm run lint` (기존 경고/오류는 무시) 통과.
10. **`TaskFilters` 컴포넌트 파일 삭제 확인**: `src/components/tasks/task-filters.tsx` 부재.

---

## 10. 참조 문서

- `docs/superpowers/specs/2026-04-26-ux-quick-capture-design.md` — P0. §3.3.3 trade-off("정렬 시각 충돌은 P1에서 해결")가 본 spec의 핵심 동기.
- `docs/architecture/dnd.md` — DnD가 `position` 의미를 어떻게 쓰는지. §3.4 trade-off의 근거.
- `docs/architecture/hierarchy.md` — ISSUE > TASK > sub-TASK 구조. `InboxTree` 정렬 규칙은 sequential ISSUE 자식의 position 단독 정렬을 강제.
- `docs/architecture/mock-backend.md` — `position` 할당 컨벤션. POST 시 `max+1` 로 들어가는 동작 확인용.
- `CLAUDE.md` — 디자인 선호 (모노크롬, MVP 톤 회피, shadcn 우선).

---

## 11. 후속 P2 후보 (별도 spec)

본 spec 구현 후 사용해보고 필요 시:

- **카드 인라인 에디터 compact 모드** — 첫 펼침 4필드 + "더 보기".
- **카드 1-tap "오늘 토글"** — 완료 원 옆 ☀.
- **키보드 네비게이션** — `j/k`(포커스), `e`(에디터), `x`(완료), `/` (검색 포커스 alt). popover에도 키보드 단축키 추가 검토.
- **bulk select** — hover 체크박스 + floating action bar. 본 spec의 `필터 (n) ▾` 패턴과 시각 통일성 가져갈 것.
- **`/today`, `/history` chrome 정리** — 본 spec 패턴 재적용 검토.
- **DnD-aware sort hint** — sortBy가 `'priority'`가 아닐 때 DnD 시 "위치 변경됨, 우선순위 정렬에서 보입니다" 같은 작은 hint 표시.
- **우선순위/출처 multi-select** — 사용자가 1개씩만 거르는 게 답답해지면 도입.
