# Today list: explicit / effective set + prompt-next

## 두 개의 set

| Set | 정의 | 어디에 |
|---|---|---|
| **Explicit** | 사용자가 직접 "오늘에 추가" 한 task ID들 | `localStorage[wid-today-task-ids]` |
| **Effective** | explicit ∪ 그 자손 전부 | `getEffectiveTodayTaskIds(explicit, allTasks)` |

Explicit set이 단일 진실. Effective set은 매 렌더마다 계산. 부모 TASK를 추가하면 sub-TASK들이 자동으로 따라오고, 부모를 빼면 같이 빠짐.

## Today 렌더 = forest

`today/page.tsx` 가 today에 속한 task만으로 트리 forest를 빌드:
- **Root**: today 안에 있는데 부모는 today에 없는 task
- **자식**: today 안에 있고 부모도 today에 있는 task (root 아래로 nested)
- Root들을 status별로 그룹핑 (`DEFAULT_STATUSES` + custom status)
- 각 root는 `TaskBranch` 컴포넌트로 렌더 (재귀적으로 자식 처리)

## hierarchy label / breadcrumb

부모가 today에 없는 sub-TASK가 root로 올라와도:
- `hierarchyLabel = 'sub-TASK'` (parent_task_id 기준 — `hierarchy.md` 참고)
- breadcrumb chip: `ISSUE: <issue 이름> › <부모 TASK 제목>`

## Prompt-next-on-complete

`promptNextInTodayIfNeeded(completedTask)` (in `src/lib/today-tasks.ts`):

발동 조건:
1. `completed.id` 가 explicit set 안에 있음 (descendant 자동 따라옴은 제외)
2. `completed.issue_id` 또는 `completed.parent_task_id` 가 있음 (sibling 개념이 의미 있는 경우만)
3. `findNextSiblingTask(completed, allTasks)` 가 다음 미완료 sibling 반환 (같은 부모, position 더 큰 것)
4. 다음 sibling이 effective set 에 아직 없음 (중복 권유 방지)

토스트:
```
✓ 완료. 다음: "다음 TASK 제목"
이 TASK도 오늘에 추가할까요?
[오늘에 추가]   (8초 자동 닫힘)
```
액션 클릭 → 다음 TASK가 explicit set 에 추가됨.

## 적용 경로

`'완료'` 상태로 PATCH가 성공한 직후 호출:
- `src/app/page.tsx` `handleStatusChange`
- `src/app/today/page.tsx` `handleStatusChange`
- `src/app/issues/[id]/page.tsx` `handleStatusChange`
- `src/components/tasks/task-inline-editor.tsx` `save()` 안

## 관련 파일

- `src/lib/today-tasks.ts` — explicit/effective set, findNextSiblingTask, promptNextInTodayIfNeeded
- `src/app/today/page.tsx` — today forest 빌드 + status 그룹
- `src/components/tasks/task-card.tsx` — breadcrumb chip 렌더
