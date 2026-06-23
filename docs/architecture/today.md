# Today list: explicit / effective set + prompt-next

## 두 개의 set

| Set | 정의 | 어디에 |
|---|---|---|
| **Explicit** | 사용자가 직접 "오늘에 추가" 한 task ID들 | `localStorage[wid-today-task-ids]` |
| **Deadline-auto** | 마감일(due date)이 오늘이거나 지난, 미완료·미보류·미삭제 task | `getDeadlineTodayTaskIds(allTasks, todayStr)` (파생, 저장 안 함) |
| **Completed-today-auto** | `completed_at`이 오늘(로컬)인 **완료** task (취소 제외) | `getCompletedTodayTaskIds(allTasks)` (파생, 저장 안 함) |
| **Flag-auto** | 서버 `is_today=true` 플래그가 켜진 미완료·미보류·미삭제 task (JIRA 자동 포함) | `getFlaggedTodayTaskIds(allTasks)` (DB 컬럼에서 파생) |
| **Effective** | (explicit ∪ flag-auto ∪ deadline-auto ∪ completed-today-auto) ∪ 그 자손 전부 | `getEffectiveTodayTaskIds(explicit, allTasks, todayStr)` |

Explicit set이 단일 진실. Deadline-auto는 task 상태에서 매번 파생 — localStorage에 안 들어감 (마감 지나거나 완료되면 자동으로 빠지고, "사용자가 골랐나?"가 흐려지지 않게). Effective set은 매 렌더마다 계산: explicit + deadline-auto + completed-today-auto를 seed로 자손까지 펼침. 부모 TASK를 추가하면 sub-TASK들이 자동으로 따라오고, 부모를 빼면 같이 빠짐. `todayStr`은 today 페이지가 mount 시점에 고정한 로컬 날짜.

### 오늘 완료된 task 자동 포함 (2026-06-05)

- 오늘(로컬 `completed_at`) **완료**된 task는 오늘에 explicit하게 추가하지 않았어도 /today의 완료 쪽에 자동 표시 — "오늘 완료한 일" 회고가 /today에 다 모이게. /inbox에서만 완료한 task도 여기 나타난다.
- **완료만 — '취소'는 제외**. 멘탈모델이 "오늘 완료한 일"이라 취소까지 끌어오지 않음(`status === '완료'` 직접 체크, `isTaskDone` 아님 — 후자는 취소 포함).
- deadline-auto와 동일하게 **파생 레이어** — explicit set(localStorage)은 불변. 되돌리기(완료 해제)하면 자동으로 빠지고, /inbox 등록 뷰 숨김 규칙(explicit set만 봄)은 영향 없음.
- "오늘"은 `localDateStr(new Date())`(로컬)로 helper 안에서 자체 계산 — 페이지 `todayStr`(UTC 파생)이 아니라 `completed_at`(로컬)과 local-vs-local 비교. `countCompletedToday`/`pruneStaleTodayIds`와 같은 기준.

### JIRA 자동 오늘 포함 — 서버 is_today 플래그 (2026-06-23)

- JIRA 웹훅으로 들어온 TASK는 `is_today=true`로 생성되어 **기본적으로 /today에** 뜬다. 사용자가 굳이 "오늘로 보내기"를 누르지 않아도 됨. (JIRA는 동기화 버튼과 무관 — 웹훅 push라 자동, `jira.md`)
- **왜 deadline-auto 대신 새 플래그인가**: 오늘 소속의 explicit 경로는 localStorage라 서버 웹훅이 못 건드린다. 가짜 deadline을 박으면 "마감" 뱃지가 붙는 부작용이 있어, DB에 명시적 today 플래그(`tasks.is_today`, migration 011)를 둔다. deadline-auto와 동급의 **파생 레이어** — `getEffectiveTodayTaskIds`가 날짜 무관하게 항상 seed로 폴딩한다. 탭이 안 열려있는 사이 도착해도, 기기가 바뀌어도 오늘에 들어온다(localStorage 비의존).
- **해제 = 전체로 내려감**: deadline-auto와 달리 이 플래그는 **토글로 끌 수 있다**. "오늘에서 빼기"(`toggleTodayMembership`)가 explicit 제거 + `is_today=false` PATCH를 함께 수행 → effective에서 빠지고 /inbox(전체)에 남는다. 다시 "오늘로 보내기"를 누르면 explicit set에 추가되어 돌아온다(플래그 재설정 불필요).
- **소속 판정 일원화**: 카드/상세의 `isTodayTask` = `explicit ∪ task.is_today`, /inbox 등록 뷰 숨김도 같은 기준(`inTodaySet` = explicit ∪ (is_today && !done)). done이면 flag-auto에서 빠지고 completed-today-auto가 회고용으로만 끌어온다.
- 토글은 async(PATCH 왕복) — 성공 후 `task-updated` 디스패치로 열린 모든 페이지가 재조회. 가드: deleted/pending/done 제외(deadline-auto와 동일).

### 마감 자동 포함 (spec 결정 4, 2026-06-03)

- 마감일이 오늘이거나 지난 미완료 task는 해 아이콘을 누르지 않아도 오늘에 자동 표시된다.
- 자동 포함된 root에는 `TaskCard`의 `reasonBadge="deadline"`로 작은 "마감" 뱃지를 붙여 왜 여기 있는지 자명하게 한다 (explicit하게 직접 추가한 항목에는 안 붙음 — `!todayIds.has(id) && deadlineTodayIds.has(id)` 조건).
- **해 토글 동작 결정**: Sun 토글은 *explicit set만* 토글한다 (기존 모델 그대로 — invariant 최소 변경).
  - deadline-auto-only 항목에서 Sun을 켜면 → explicit에도 들어가 sticky해짐(마감 지나도 유지).
  - deadline-auto 항목에서 Sun을 꺼도 → explicit에서만 빠지고, 마감 조건이 살아있는 한 오늘에 그대로 남는다 ("마감" 뱃지가 그 이유를 설명). 즉 마감 기반 자동 포함은 토글로 끌 수 없다 — 끄려면 task의 마감일/상태를 바꿔야 한다. 하루 숨김 같은 별도 persistence는 도입하지 않음(가장 단순 + pending invariant 불간섭).

## Root 수동 정렬 (2026-06-04)

status 그룹 헤더 드래그(그룹 순서)와 별개로, **그룹 안 개별 root TASK도 grip
핸들로 드래그 reorder** 가능. 순서는 `localStorage[wid-today-root-order]`
(`src/lib/manual-order.ts`) overlay — 같은 그룹 안에서만, cross-group 드래그는
무시(상태 변경 아님). 한 DndContext가 두 네임스페이스를 받는다: 상태 문자열
id = 그룹 reorder, `tsk:` prefix = root reorder.

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

## 카드 스타일 (2026-06-03)

Today도 두 줄 카드(출처 아이콘 + 제목 / ISSUE 칩·마감·요청자)를 공유한다.
root top-level TASK에는 `issueChip`(id+name)을 전달해 소속 ISSUE 칩을 띄운다
(`buildIssueChip`). sub-TASK·자식에는 전파하지 않는다. sub 펼침은 Today의
기존 forest(TaskBranch chevron)가 담당하므로 카드의 `subCount` 토글은 Today에서
쓰지 않는다(이중 펼침 방지).

## 오늘 토글의 키보드 경로 (2026-06-03)

해 아이콘과 별개로, `TaskDetailPanel`에도 "오늘로 보내기/오늘에서 빼기"
버튼이 있어 키보드/포커스 경로로도 오늘 소속을 토글할 수 있다. 두 진입점 모두
`toggleTodayMembership(task)`를 호출 — explicit set과 서버 `is_today` 플래그를
함께 다룬다(Flag-auto 항목 참조). explicit 변경은 `today-tasks-changed`,
플래그 PATCH는 `task-updated` 이벤트로 열린 화면들이 동기화된다.

## Prompt-next-on-complete + 오늘 누적 (spec 결정 5)

`promptNextInTodayIfNeeded(completedTask)` (in `src/lib/today-tasks.ts`) — task가 처리됨(완료/취소)으로 전이된 직후 호출. 한 번의 완료에 **fetch 1회 + 토스트 1개**만:

1. `/api/tasks?deleted=false` 1회 fetch.
2. `countCompletedToday(allTasks)` = 오늘 날짜(local, `completed_at` 기준)에 완료된 task 수 → tally 문자열 "오늘 N개 완료".
3. prompt-next 권유 조건이 맞으면(아래) sibling 권유 토스트를 띄우고 description에 tally를 함께 표시.
4. 권유 조건이 안 맞으면 plain `✓ 오늘 N개 완료` tally 토스트만.

prompt-next 권유 조건:
- `completed.id` 가 explicit set 안에 있음 (descendant 자동 따라옴은 제외)
- `completed.issue_id` 또는 `completed.parent_task_id` 가 있음 (sibling 개념이 의미 있는 경우만)
- `findNextSiblingTask` 가 다음 미완료 sibling 반환 (같은 부모, position 더 큰 것)
- 다음 sibling이 effective set 에 아직 없음 (중복 권유 방지)

토스트(권유 있을 때):
```
✓ 완료. 다음: "다음 TASK 제목"
오늘 N개 완료 · 이 TASK도 오늘에 추가할까요?
[오늘에 추가]   (8초 자동 닫힘)
```
액션 클릭 → 다음 TASK가 explicit set 에 추가됨.

tally count는 effective-today 멤버십이 아니라 "오늘 날짜에 완료된 수"로 단순화 — 모든 완료 경로(인박스/today/issue/inline editor)에서 동일 함수를 써 일관성 유지.

## 적용 경로

처리됨(완료/취소) 상태로 PATCH가 성공한 직후 호출:
- `src/app/inbox/page.tsx` `handleStatusChange` (구 `/` 인박스 — IA 단순화로 `/inbox`로 이동)
- `src/app/today/page.tsx` `handleStatusChange`
- `src/app/issues/[id]/page.tsx` `handleStatusChange`
- `src/components/tasks/task-inline-editor.tsx` `save()` 안

## 관련 파일

- `src/lib/today-tasks.ts` — explicit/effective set, findNextSiblingTask, promptNextInTodayIfNeeded
- `src/app/today/page.tsx` — today forest 빌드 + status 그룹
- `src/components/tasks/task-card.tsx` — breadcrumb chip 렌더
