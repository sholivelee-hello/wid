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
| `POST /api/tasks` | `issue_id`+`parent_task_id` 동시 set 400 (`DUAL_PARENT`), `parent_task_id` 가 다른 sub-TASK면 400 (`MAX_DEPTH`), 없는/삭제된 부모 400 (`PARENT_NOT_FOUND`) |
| `PATCH /api/tasks/[id]` | 위와 동일 + 자식 있는 TASK를 sub-TASK로 옮기려는 경우 400 (`WOULD_DEEPEN`) + 자기 자신을 부모로 지정 400 (`CYCLE`) — 부모는 항상 top-level이어야 하므로 더 깊은 cycle은 `MAX_DEPTH`가 같이 차단. 허용 필드 화이트리스트 적용 (`mock-backend.md` 참고) |
| `TaskBranch` UI | `+ sub-TASK 추가` 버튼은 `depth === 0` 일 때만 렌더 |
| `InboxTree` DnD | top-level↔sub-TASK 변환 시도는 모두 거절 + toast (`dnd.md` 참고) |

> 2026-06-12: mock → Supabase 전환(`a991a40`) 때 서버 가드가 통째로 사라졌던 것을
> 재구현. mock 시절의 `DEPTH_FLIP`·`INCOMPLETE_CHILDREN`·`normalizeDepth`(자가치유)는
> 현재 서버에 **없다** — depth flip은 UI(DnD 가드)에서만 차단, 완료 전파는 클라이언트
> 책임. 다시 필요해지면 `PATCH /api/tasks/[id]` 가드 블록에 추가.

## hierarchy 배지는 데이터 기준, render depth 아님

`TaskCard.hierarchyLabel` 은 `node.task.parent_task_id` 로 계산. Today 페이지처럼 sub-TASK가 forest의 root로 렌더되는 경우에도 `'sub-TASK'` 배지 유지 (R3 평가 후 수정).

## 표시 정책 (2026-06-03 평평한 리스트)

- `/inbox`: top-level TASK만 평면 리스트로. sub-TASK는 카드 2행 `↳ sub N`
  토글로 그 자리 펼침 — 트리 들여쓰기·`InboxTree`·`buildTree` 미사용.
- `/issues/[id]`·`/today`: 계층 트리를 유지(`buildTree` + `TaskBranch`). 이슈
  상세에서만 드래그 reorder.
- sub-TASK가 forest root로 올라오는 경우(Today)에도 `isSubtask`(parent_task_id
  기준) 표시는 유지.

### /inbox 정렬·그룹 (2026-06-03, 2026-06-04 개정)

- 기본(등록 뷰): `created_at desc` base + **드래그 수동 정렬 overlay** (2026-06-04
  사용자 요청 — "잡아서 끌어올리기"). grip 핸들은 검색·필터 없는 등록 뷰에서만.
  순서는 `localStorage[wid-inbox-manual-order]` (`src/lib/manual-order.ts`) —
  DB `position`은 이슈 상세 checklist 전용이므로 건드리지 않는다. 저장 후 새로
  생긴 task는 base 순서로 맨 위.
- **오늘로 보낸 task 숨김** (2026-06-04): explicit today set에 든 top-level task는
  등록 뷰에서 숨긴다(오늘 탭 담당). 오늘에서 빼면 `today-tasks-changed`로 즉시
  복귀. deadline-auto 포함분은 사용자가 "보낸" 게 아니므로 숨기지 않음. 숨긴
  개수는 리스트 아래 안내 줄로 표시.
- 완료 칩 뷰(`showCompleted`): `completed_at desc`(null은 `created_at` fallback).
  순회하며 날짜가 바뀔 때 **오늘 / 어제 / M월 d일 / yyyy년 M월 d일** 그룹 헤더 삽입.
- 커스텀 뷰는 자체 `view.sortBy`(기본 `created_at`)로 독립 정렬 — 메인 인박스
  정렬과 무관.

## 관련 파일

- `src/app/api/tasks/route.ts` — POST 가드 (DUAL_PARENT, MAX_DEPTH, PARENT_NOT_FOUND)
- `src/app/api/tasks/[id]/route.ts` — PATCH 가드 (DUAL_PARENT, CYCLE, MAX_DEPTH, WOULD_DEEPEN, PARENT_NOT_FOUND) + 필드 화이트리스트
- `src/components/inbox/inbox-tree.tsx` — DnD onDragEnd, TASK↔sub-TASK 변환 거절 가드
- `src/components/tasks/task-branch.tsx` — sub-TASK 추가 버튼 depth 0 한정
- `src/components/tasks/task-card.tsx` — hierarchyLabel 데이터 기준 계산

## Hierarchy depth는 생성 시 결정, 이후 불변

한번 top-level TASK이면 영원히 top-level. 한번 sub-TASK이면 영원히 sub-TASK. DnD든 PATCH든 이 불변량을 깨면 안 됨.

- DnD: `inbox-tree.tsx onDragEnd` 안 가드들이 4가지 변환 시도 모두 차단 + toast.
- API: `DEPTH_FLIP` 가드는 Supabase 전환 후 미구현 — 서버는 `MAX_DEPTH`/`WOULD_DEEPEN`/`CYCLE`로
  3-level 위반만 차단하고, null↔non-null 토글 자체의 차단은 UI 가드가 담당 (2026-06-12 현황).
- 같은 depth 내 cross-parent 이동(sub-TASK가 다른 parent task로) 또는 cross-issue 이동(top-level이 다른 ISSUE로)은 OK — depth 자체가 바뀌지 않음.

depth 변환이 정말 필요하면 task를 삭제하고 새로 만들어야 함 — 의도된 design.

자세한 DnD 흐름 → `dnd.md`.
