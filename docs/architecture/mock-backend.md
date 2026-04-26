# Mock backend 컨벤션

`isMockMode()` 분기 안에서 동작하는 in-memory dev backend. dev 서버 수명 동안 state 유지, 재시작하면 시드로 리셋.

## 공유 mutable refs

각 `route.ts` 모듈이 `const tasks` / `const issues` 배열을 시드 (`MOCK_TASKS` / `MOCK_ISSUES`) 로 초기화. 형제 라우트 (`[id]/route.ts`) 가 `__tasksRef()` / `__issuesRef()` 로 접근.

```ts
// src/app/api/tasks/route.ts
const tasks: typeof MOCK_TASKS = [...MOCK_TASKS];
export const __tasksRef = () => tasks;
```

## ⚠️ POST는 반드시 push해야 함

원래 POST 핸들러가 새 task 객체를 만들어서 응답으로만 돌려주고 배열에 push 안 했었음. 결과: 응답은 201 OK이지만 다음 GET에 새 task가 없어서 UI에 안 나타남 (silent fail).

**규칙: 모든 POST는 공유 배열에 mutate해야 함.**

```ts
const newTask = { ... };
tasks.push(newTask);
return NextResponse.json(newTask, { status: 201 });
```

## position 할당

- **Tasks**: `position = max(siblings) + 1`. 같은 `issue_id` AND 같은 `parent_task_id` 의 siblings. POST + reparent 모두에서 사용.
- **Issues**: `position = max + 1` (활성 issue 전체 기준).

## 모듈 로드 시 normalize

`src/app/api/tasks/route.ts` 의 `normalizeDepth(tasks)` 가 모듈 init 시 1회 실행. depth ≥ 2 행을 최상위 TASK 조상의 자식으로 평탄화. 일회성 마이그레이션이 아니라 부팅 시 방어적 자가치유 패턴.

## PATCH `/api/tasks/[id]` 가드 카탈로그

| 코드 | HTTP | 트리거 |
|---|---|---|
| `DUAL_PARENT` | 400 | `issue_id` 와 `parent_task_id` 둘 다 set 시도 |
| `INCOMPLETE_CHILDREN` | 409 | sub-TASK 미완료 상태에서 부모를 완료 처리 |
| `CYCLE` | 400 | `parent_task_id` 후보가 자기 자신의 자손 |
| `MAX_DEPTH` | 400 | `parent_task_id` 가 다른 sub-TASK를 가리킴 (3-level 위반) |
| `WOULD_DEEPEN` | 400 | 자식 있는 TASK를 sub-TASK로 옮기려 함 |

## 허용 PATCH 필드

```ts
// tasks
['title', 'description', 'priority', 'status', 'source',
 'requester', 'requested_at', 'deadline', 'completed_at',
 'notion_task_id', 'slack_url', 'slack_channel', 'slack_sender',
 'delegate_to', 'follow_up_note',
 'issue_id', 'parent_task_id', 'sort_mode', 'position']

// issues
['name', 'deadline', 'sort_mode', 'position', 'notion_issue_id']
```

`color` 는 issue 타입에서 제거됨 (UI에서 색상 모두 제거됨, `inline-editing.md` / 인박스 UX 변경 참고).

## 관련 파일

- `src/app/api/tasks/route.ts` — 메인 task 저장소 + 헬퍼들
- `src/app/api/tasks/[id]/route.ts` — 가드 있는 PATCH/DELETE
- `src/app/api/issues/route.ts` — issue 저장소
- `src/app/api/issues/[id]/route.ts` — 가드 있는 PATCH/DELETE
- `src/lib/mock-data.ts` — task 시드
- `src/lib/mock-issues.ts` — issue 시드
