# Hierarchy invariant: ISSUE > TASK > sub-TASK

3개의 논리 계층, 2개의 task 레벨. 그 이상 깊어지면 버그.

## 데이터 모양

- `Task.issue_id`: optional — Issue로 연결
- `Task.parent_task_id`: optional — 다른 Task로 연결 (sub-TASK 표시)
- 상호 배타: `issue_id != null && parent_task_id != null` 은 거절 (`code: DUAL_PARENT`)

## 깊이 규칙

- 최상위 TASK: `parent_task_id === null`
- sub-TASK: `parent_task_id` 가 최상위 TASK 가리킴
- 그 이상의 nesting (sub-sub-TASK)은 무효

## 강제 위치

| 어디서 | 어떻게 |
|---|---|
| `POST /api/tasks` | `parent_task_id` 가 다른 sub-TASK면 400 (`MAX_DEPTH`) |
| `PATCH /api/tasks/[id]` | 위와 동일 + 자식 있는 TASK를 sub-TASK로 옮기려는 경우 400 (`WOULD_DEEPEN`) + `parent_task_id` null↔non-null 변환 거절 (`DEPTH_FLIP`) |
| `TaskBranch` UI | `+ sub-TASK 추가` 버튼은 `depth === 0` 일 때만 렌더 |
| `InboxTree` DnD | top-level↔sub-TASK 변환 시도는 모두 거절 + toast (`dnd.md` 참고) |
| 모듈 로드 시 | `normalizeDepth()` 가 depth ≥ 2 행을 최상위 TASK 조상에게 재할당 (자가치유) |

## 핵심 헬퍼 (둘 다 `src/app/api/tasks/route.ts`)

```ts
isValidTaskParent(taskList, parentId)  // parentId 가 최상위 TASK인가?
hasChildTasks(taskList, id)            // 이 task에 자식이 있는가?
normalizeDepth(taskList)               // 모듈 로드 시 한번 깊이 평탄화
```

## hierarchy 배지는 데이터 기준, render depth 아님

`TaskCard.hierarchyLabel` 은 `node.task.parent_task_id` 로 계산. Today 페이지처럼 sub-TASK가 forest의 root로 렌더되는 경우에도 `'sub-TASK'` 배지 유지 (R3 평가 후 수정).

## 표시 정책 (2026-06-03 평평한 리스트)

- `/inbox`: top-level TASK만 평면 리스트로. sub-TASK는 카드 2행 `↳ sub N`
  토글로 그 자리 펼침 — 트리 들여쓰기·`InboxTree`·`buildTree` 미사용.
- `/issues/[id]`·`/today`: 계층 트리를 유지(`buildTree` + `TaskBranch`). 이슈
  상세에서만 드래그 reorder.
- sub-TASK가 forest root로 올라오는 경우(Today)에도 `isSubtask`(parent_task_id
  기준) 표시는 유지.

### /inbox 정렬·그룹 (2026-06-03)

- 기본(등록 뷰): `created_at desc` 고정 — 정렬 컨트롤 없음(죽은 정렬 UI 제거).
- 완료 칩 뷰(`showCompleted`): `completed_at desc`(null은 `created_at` fallback).
  순회하며 날짜가 바뀔 때 **오늘 / 어제 / M월 d일 / yyyy년 M월 d일** 그룹 헤더 삽입.
- 커스텀 뷰는 자체 `view.sortBy`(기본 `created_at`)로 독립 정렬 — 메인 인박스
  정렬과 무관.

## 관련 파일

- `src/app/api/tasks/route.ts` — POST 가드, 헬퍼들, normalizeDepth
- `src/app/api/tasks/[id]/route.ts` — PATCH 가드 (DUAL_PARENT, DEPTH_FLIP, INCOMPLETE_CHILDREN, CYCLE, MAX_DEPTH, WOULD_DEEPEN)
- `src/components/inbox/inbox-tree.tsx` — DnD onDragEnd, TASK↔sub-TASK 변환 거절 가드
- `src/components/tasks/task-branch.tsx` — sub-TASK 추가 버튼 depth 0 한정
- `src/components/tasks/task-card.tsx` — hierarchyLabel 데이터 기준 계산

## Hierarchy depth는 생성 시 결정, 이후 불변

한번 top-level TASK이면 영원히 top-level. 한번 sub-TASK이면 영원히 sub-TASK. DnD든 PATCH든 이 불변량을 깨면 안 됨.

- DnD: `inbox-tree.tsx onDragEnd` 안 가드들이 4가지 변환 시도 모두 차단 + toast.
- API: `PATCH /api/tasks/[id]` 의 `DEPTH_FLIP` 가드가 `parent_task_id` 의 null↔non-null 토글 차단 (defense-in-depth).
- 같은 depth 내 cross-parent 이동(sub-TASK가 다른 parent task로) 또는 cross-issue 이동(top-level이 다른 ISSUE로)은 OK — depth 자체가 바뀌지 않음.

depth 변환이 정말 필요하면 task를 삭제하고 새로 만들어야 함 — 의도된 design.

자세한 DnD 흐름 → `dnd.md`.
