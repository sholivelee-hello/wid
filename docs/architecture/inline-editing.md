# Inline editing (오른쪽 sheet 대체)

TaskCard 클릭 → 카드 안에서 에디터가 펼쳐짐. 오른쪽 슬라이드아웃 sheet 안 씀.

## 클릭 시맨틱

| 입력 | 동작 |
|---|---|
| TASK 카드 클릭 (자식 유무 무관) | 인라인 에디터 토글 |
| Chevron 클릭 | sub-TASK 펼침/접힘 |
| `↳ sub-TASK N개 (펼치기/접기)` 버튼 | 펼침 토글 (큰 hit area, 단일 always-visible 밴드) |
| Grip 클릭 | 드래그 시작 (sortable, 카드 클릭과 분리) |
| 제목 텍스트 | 단순 텍스트 + `title=` native tooltip (긴 제목용) |
| 우클릭 (카드 영역) | 액션 컨텍스트 메뉴 (완료/오늘/상태/보류/상세/휴지통) — 마우스 이동 거리 최소화용. 인라인 에디터 열림 시(`editing`)에는 ContextMenu를 끼우지 않아 텍스트 필드에서 브라우저 기본 우클릭이 그대로 뜬다. |

우클릭 메뉴는 `src/components/ui/context-menu.tsx`(base-ui `@base-ui/react/context-menu`, dropdown-menu와 동일 스타일)를 쓰고, TaskCard가 이미 가진 핸들러(`onComplete`/`onStatusChange`/`onPend`/`onDelete`/`onSelect`)와 `toggleTodayTask`를 그대로 재사용한다 (새 로직 없음). 컨텍스트 분기는 `⋯` 드롭다운과 동일하게 prop 유무로만 — `onStatusChange` 없으면 상태 변경 숨김, `onPend` 없으면 보류 숨김, `onDelete` 없으면 휴지통 숨김. `ContextMenuTrigger render={card}` 로 카드 div에 머지(추가 DOM 없음) — `divide-y` 레이아웃·grip·인라인 버튼의 `stopPropagation`과 충돌하지 않는다 (우클릭=contextmenu 이벤트는 별개 경로).

이전 패턴 (R1까지): 자식 있는 TASK는 카드 클릭 = 펼침, 제목 클릭 = 에디터. R2에서 충돌이 UX 평가의 HIGH 블로커로 지적되어 카드 클릭 = 항상 에디터로 통합.

## TaskInlineEditor 라이프사이클

`editing === true` 일 때 카드 본문 아래 렌더.

필드별 저장 트리거:
- **Title / requester / delegate / description**: `onBlur` (값 변경된 경우만)
- **Status / priority / deadline**: `onChange` (즉시)

`save()` 패턴:
```ts
try {
  setSaving(true);
  await apiFetch(...);
  window.dispatchEvent(new CustomEvent('task-updated'));
  setSavedAt(Date.now());
  if (patch.status === '완료' && task.status !== '완료') {
    promptNextInTodayIfNeeded({ ...task, status: '완료' });
  }
} finally {
  setSaving(false);
}
```
`apiFetch` 실패 시 자체 토스트가 뜸 (`suppressToast` 안 씀).

## Pill 표시

- **저장 중...** : `Loader2` 스피너 + 텍스트, `saving === true && savedAt === null` 일 때
- **✓ 저장됨** : 초록 체크, `savedAt` 설정 후 1.5초간

## state 소유

페이지가 `editingTaskId` 추적. `onSelect` 토글 패턴:
```ts
onSelect: (id) => setEditingTaskId(prev => (prev === id ? null : id))
```
`InboxTree` → `TaskBranch` → `TaskCard` 로 props drilling.

## 제거된 것: TaskDetailPanel sheet

인박스 / today / issue 상세에서 `<Sheet>` 더이상 안 띄움. `app/history/page.tsx` 만 아직 사용 중 (DayDetailPanel 레이아웃 재설계 필요해서 보류).

## 관련 파일

- `src/components/tasks/task-card.tsx` — 카드 클릭 핸들러, editing 모드 분기, breadcrumb 렌더
- `src/components/tasks/task-inline-editor.tsx` — 전체 에디터 + 저장 라이프사이클
- `src/components/tasks/task-branch.tsx` — TaskCard에 `editing`/`onCloseEdit` 전달
- `src/app/page.tsx`, `src/app/today/page.tsx`, `src/app/issues/[id]/page.tsx` — `editingTaskId` state
