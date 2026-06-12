# Mock backend 컨벤션 (역사 문서 — 현재는 Supabase)

> ⚠️ 2026-04-29 Supabase 실연결로 mock 백엔드는 삭제됐다. 이 문서는 당시 규칙의
> 기록이며, 아래 "PATCH 가드 카탈로그"와 "허용 PATCH 필드"는 2026-06-12 Supabase
> 라우트에 재구현된 현행 계약으로 갱신됨. 나머지 섹션(공유 refs, normalizeDepth)은
> 더 이상 코드에 없다.

`isMockMode()` 분기 안에서 동작하던 in-memory dev backend. dev 서버 수명 동안 state 유지, 재시작하면 시드로 리셋.

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

## PATCH `/api/tasks/[id]` 가드 카탈로그 (현행 — Supabase 라우트, 2026-06-12 재구현)

| 코드 | HTTP | 트리거 |
|---|---|---|
| `DUAL_PARENT` | 400 | `issue_id` 와 `parent_task_id` 둘 다 set 시도 (POST에도 동일) |
| `CYCLE` | 400 | `parent_task_id` 후보가 자기 자신 (깊은 cycle은 `MAX_DEPTH`가 차단) |
| `MAX_DEPTH` | 400 | `parent_task_id` 가 다른 sub-TASK를 가리킴 (3-level 위반, POST에도 동일) |
| `WOULD_DEEPEN` | 400 | 자식 있는 TASK를 sub-TASK로 옮기려 함 |
| `PARENT_NOT_FOUND` | 400 | `parent_task_id` 가 없는/삭제된 task |

mock 시절 있던 `INCOMPLETE_CHILDREN`(409)과 `DEPTH_FLIP`은 현행 서버에 없음 — `hierarchy.md` 참고.

## 허용 PATCH 필드 (현행)

```ts
// tasks — src/app/api/tasks/[id]/route.ts ALLOWED_PATCH_FIELDS
['title', 'description', 'status',
 'requester', 'requested_at', 'deadline', 'completed_at',
 'delegate_to', 'follow_up_note',
 'issue_id', 'parent_task_id', 'sort_mode', 'position', 'name_locked']

// issues — src/app/api/issues/[id]/route.ts allowed
['name', 'deadline', 'sort_mode', 'position', 'notion_issue_id']
```

`source`·`notion_task_id`·`slack_*` 등 출처 식별자는 PATCH 불가 — 출처 스푸핑 방지.
`is_deleted`/`pending_at` 도 전용 라우트(DELETE, pend/unpend)만 만진다.

`color` 는 issue 타입에서 제거됨 (UI에서 색상 모두 제거됨, `inline-editing.md` / 인박스 UX 변경 참고).

## 관련 파일

- `src/app/api/tasks/route.ts` — 메인 task 저장소 + 헬퍼들
- `src/app/api/tasks/[id]/route.ts` — 가드 있는 PATCH/DELETE
- `src/app/api/issues/route.ts` — issue 저장소
- `src/app/api/issues/[id]/route.ts` — 가드 있는 PATCH/DELETE
- `src/lib/mock-data.ts` — task 시드
- `src/lib/mock-issues.ts` — issue 시드
