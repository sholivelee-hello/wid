# Drag & drop: sortable across 4 levels

`@dnd-kit/core` + `@dnd-kit/sortable`. 인박스에서 reorder + reparent + unlink 모두 처리.

## ID 네임스페이스

| Prefix | 의미 | 등록 위치 |
|---|---|---|
| `iss:<id>` | sortable issue | `inbox-tree.tsx` SortableIssueItem |
| `dropiss:<id>` | issue 헤더 drop zone (cross-issue task reparent) | `inbox-tree.tsx` |
| `tsk:<id>` | sortable task | `inbox-tree.tsx`, `task-branch.tsx` |
| `unlinked` | independent로 분리하는 점선 박스 | `inbox-tree.tsx` DroppableUnlinked |

(`merge:<id>` 는 v1에 있던 drag-merge 기능. v2에서 sortable과 충돌해서 제거.)

## 4개의 SortableContext

1. 최상위 ISSUE 리스트 — `inbox-tree.tsx`
2. ISSUE 내부 TASK 리스트 — `inbox-tree.tsx` (각 issue별)
3. TASK 내부 sub-TASK 리스트 — `task-branch.tsx` (재귀, `enableSortable=true` 일 때만)
4. 독립 TASK 리스트 — `inbox-tree.tsx`

## 드래그 핸들 패턴

명시적 `<GripVertical>` 버튼이 sortable activator. **절대 wrapper 전체에 listeners 뿌리지 말 것** — 카드 클릭 → 인라인 에디터 동작이랑 충돌남.

```tsx
const sortable = useSortable({ id: ... });
<div ref={sortable.setNodeRef} style={transformStyle}>
  <button
    ref={sortable.setActivatorNodeRef}
    {...sortable.attributes}
    {...sortable.listeners}
    className="opacity-30 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 ..."
    onClick={(e) => e.stopPropagation()}
  >
    <GripVertical className="h-3.5 w-3.5" />
  </button>
  {/* row content */}
</div>
```

발견 가능성을 위해 `opacity-30` 기본 + hover/focus 시 `100`. focus-visible ring으로 키보드 사용자도 인지.

## Sensors

```ts
useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```
키보드: Tab → 그립 → Space (lift) → Arrow ↑↓ → Space (drop) → Esc (cancel).

## Drop 의미 (`onDragEnd`)

```
active=iss:X, over=iss:Y      → 이슈 순서 변경
active=tsk:X, over=dropiss:Y  → task를 issue Y로 reparent (마지막 위치)  *
active=tsk:X, over=unlinked   → task에서 issue/parent 해제 (independent로) *
active=tsk:X, over=tsk:Y:
  같은 부모            → 같은 부모 안에서 reorder
  다른 부모, 같은 depth → reparent + Y의 위치에 끼워넣기
  다른 부모, 다른 depth → 거부 (toast)                                  *
```

`*` 표시는 hierarchy invariant 강제 지점.

## Hierarchy invariant (DnD가 절대 깨선 안 되는 룰)

**TASK ↔ sub-TASK 변환 금지.** task의 hierarchy depth(top-level vs sub)는 생성 시점에 결정되며 DnD로는 절대 바뀌지 않는다.

거부 케이스:
- sub-TASK를 ISSUE 헤더(`dropiss:`)에 떨어뜨림 → top-level 승격 거부.
- sub-TASK를 unlinked 영역에 떨어뜨림 → 독립 top-level 분리 거부.
- top-level TASK를 sub-TASK 위에 떨어뜨림 → sub로 강등 거부.
- sub-TASK를 top-level TASK 위에 떨어뜨림 → top-level 승격 거부.

거부 시: 로컬 state / 서버 PATCH 모두 미수행 + `toast()` 로 사용자에게 통지. 하위 어떤 mutation 헬퍼(`reparentTaskToIssueLast`, `unlinkTask`, `reparentTaskAtTarget`)도 호출되지 않는다.

시각 hint도 함께 — sub-TASK drag 중에는 ISSUE 헤더의 drop ring과 unlinked 점선 박스가 둘 다 비활성화 (`SortableIssueItem dropEnabled=draggingTopLevelTask`, `<DroppableUnlinked />` 도 `draggingTopLevelTask` 일 때만 마운트).

같은 depth 내 reparent는 OK:
- top-level → 다른 ISSUE의 top-level (cross-issue 이동) ✓
- sub-TASK → 다른 부모 TASK의 sub-TASK (cross-parent 이동) ✓

depth 변경이 필요한 경우는 인라인 에디터의 ISSUE chip 같은 명시적 액션으로만 가능 — DnD는 reorder + 같은 depth reparent 전용.

## 옵티미스틱 상태

페이지가 `tasks` / `issues` state를 보유하고 `setTasks`/`setIssues`를 `InboxTree`에 props로 전달. Sortable 핸들러는 즉시 로컬 state 갱신 후 백그라운드에서 PATCH. 실패 시 `onMutate()` 로 fetch 재시도.

## SortableTaskItem render-prop

자식이 grip handle을 직접 렌더할 수 있도록 render-prop API:
```tsx
<SortableTaskItem id={taskId}>
  {(handle) => (
    <TaskBranch ... dragHandle={handle} />
  )}
</SortableTaskItem>
```
`handle = { listeners, attributes, setActivatorNodeRef }`.

## 관련 파일

- `src/components/inbox/inbox-tree.tsx` — DndContext, sensors, onDragEnd, mutation 헬퍼들, SortableIssueItem
- `src/components/tasks/task-branch.tsx` — SortableTaskItem (render-prop), DragHandle, recursive sub-TASK SortableContext
- `src/components/issues/issue-row.tsx` — `dragHandleSlot` prop로 grip 받음
