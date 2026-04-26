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
| `PATCH /api/tasks/[id]` | 위와 동일 + 자식 있는 TASK를 sub-TASK로 옮기려는 경우 400 (`WOULD_DEEPEN`) |
| `TaskBranch` UI | `+ sub-TASK 추가` 버튼은 `depth === 0` 일 때만 렌더 |
| 모듈 로드 시 | `normalizeDepth()` 가 depth ≥ 2 행을 최상위 TASK 조상에게 재할당 (자가치유) |

## 핵심 헬퍼 (둘 다 `src/app/api/tasks/route.ts`)

```ts
isValidTaskParent(taskList, parentId)  // parentId 가 최상위 TASK인가?
hasChildTasks(taskList, id)            // 이 task에 자식이 있는가?
normalizeDepth(taskList)               // 모듈 로드 시 한번 깊이 평탄화
```

## hierarchy 배지는 데이터 기준, render depth 아님

`TaskCard.hierarchyLabel` 은 `node.task.parent_task_id` 로 계산. Today 페이지처럼 sub-TASK가 forest의 root로 렌더되는 경우에도 `'sub-TASK'` 배지 유지 (R3 평가 후 수정).

## 관련 파일

- `src/app/api/tasks/route.ts` — POST 가드, 헬퍼들, normalizeDepth
- `src/app/api/tasks/[id]/route.ts` — PATCH 가드 (DUAL_PARENT, INCOMPLETE_CHILDREN, CYCLE, MAX_DEPTH, WOULD_DEEPEN)
- `src/components/tasks/task-branch.tsx` — sub-TASK 추가 버튼 depth 0 한정
- `src/components/tasks/task-card.tsx` — hierarchyLabel 데이터 기준 계산

## Drag-reparent 시 depth 보존

`reparentTaskAtTarget(dragged, target)` 은 `parent_task_id = target.parent_task_id` 로 설정 (target과 sibling). target이 sub-TASK여도 dragged는 sub-TASK가 됨 (depth 1). target이 자식 있는 TASK였으면 dragged도 자식 있는 채로 sub-TASK로 들어가는 게 가능한데, 이 경우는 PATCH가 `WOULD_DEEPEN` 으로 거절. 자세한 내용 → `dnd.md`.
