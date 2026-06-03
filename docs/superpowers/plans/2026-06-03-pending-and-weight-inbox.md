# 보류함 + 우선순위 제거 + 무게 인박스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** task/ISSUE를 인박스에서 치워두는 보류함(pending) 기능을 만들고, priority 필드를 전면 제거하고, 인박스 카드에 마감일 기반 시각 무게(heavy/normal/light)를 적용한다.

**Architecture:** `pending_at timestamptz` soft-flag를 tasks/issues에 추가(휴지통 `is_deleted` 패턴 복제). GET 목록 기본 쿼리는 pending 제외, `?pending=true`로 보류함만 조회. 보류/복귀는 전용 POST 라우트에서 하위 전파(3-level invariant라 직계 children까지만). priority는 DB 컬럼부터 UI까지 제거하고, 무게는 deadline에서 클라이언트 계산.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase(JS client), Tailwind v4, shadcn/ui. 테스트 러너 없음 — 검증은 `npm run build` + `npx eslint` + dev 서버 curl + Supabase SQL.

**Spec:** `docs/superpowers/specs/2026-06-03-pending-and-weight-inbox-design.md`

**참고 — 이미 구현돼 있어 작업 불필요한 것:** spec §3의 "ISSUE 헤더 진행률(n/m) + 가는 progress bar"는 `src/components/issues/issue-row.tsx:128-152`에 이미 존재한다. 이 플랜에 해당 작업 없음.

**검증 환경 메모:**
- dev 서버: `npm run dev` (포트 3000). curl 검증 시 백그라운드 실행.
- DB 확인: Supabase MCP `execute_sql` (project_id: `merdoqdtujfnickbgmhz`) 또는 앱 API로 간접 확인.
- 커밋 메시지 끝에 항상: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: DB 마이그레이션 005 — pending_at 추가 + priority 제거

**Files:**
- Create: `supabase/migrations/005_pending_and_drop_priority.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 보류(pending) soft-flag: 휴지통 is_deleted 패턴과 동일. null = 활성.
alter table tasks add column if not exists pending_at timestamptz;
alter table issues add column if not exists pending_at timestamptz;

-- 우선순위 필드 전면 제거 (사용자 결정 2026-06-03 — 기존 값 폐기).
alter table tasks drop column if exists priority;

create index if not exists idx_task_pending on tasks(pending_at) where pending_at is not null;
create index if not exists idx_issue_pending on issues(pending_at) where pending_at is not null;
```

- [ ] **Step 2: Supabase에 적용**

Supabase MCP 도구 `mcp__plugin_supabase_supabase__apply_migration` 호출:
- project_id: `merdoqdtujfnickbgmhz`
- name: `pending_and_drop_priority`
- query: 위 SQL 전체

- [ ] **Step 3: 적용 확인**

`mcp__plugin_supabase_supabase__execute_sql` 로:

```sql
select column_name from information_schema.columns
where table_name = 'tasks' and column_name in ('pending_at', 'priority');
```

Expected: `pending_at` 1행만 반환 (priority 없음).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_pending_and_drop_priority.sql
git commit -m "feat: pending_at 컬럼 추가 + priority 컬럼 제거 (마이그레이션 005)"
```

---

### Task 2: priority 전면 제거 (타입 → API → UI)

DB 컬럼이 사라졌으므로 이 태스크가 끝나기 전까지 task 생성 API가 500을 낸다 (insert에 priority 포함). **Task 1 직후 바로 진행할 것.** 중간 단계는 컴파일이 깨질 수 있으므로 빌드 검증·커밋은 이 태스크 끝에서 1회.

**Files:**
- Modify: `src/lib/types.ts:1-3, 34-58`
- Modify: `src/lib/constants.ts:7, 25-30`
- Modify: `src/lib/custom-views.ts`
- Modify: `src/app/api/tasks/route.ts:9, 27, 58`
- Modify: `src/app/page.tsx` (여러 곳 — 아래 명시)
- Modify: `src/components/tasks/inbox-filter-popover.tsx`
- Modify: `src/components/tasks/view-edit-form.tsx`
- Modify: `src/components/tasks/task-quick-capture.tsx`
- Modify: `src/components/tasks/task-inline-editor.tsx:29, 39, 191-226`
- Modify: `src/components/tasks/task-detail-panel.tsx:65, 87, 187-191, 462-470`
- Modify: `src/components/tasks/task-form.tsx:10, 26, 55, 110-119`
- Modify: `src/app/tasks/trash/page.tsx:142`
- Modify: `src/components/inbox/inbox-tree.tsx:60, 80-83`

- [ ] **Step 1: `src/lib/types.ts` — Priority 타입과 필드 제거**

1행의 `export type Priority = '긴급' | '높음' | '보통' | '낮음';` 삭제.
`Task` 인터페이스에서 `priority: Priority;` 행 삭제.

- [ ] **Step 2: `src/lib/constants.ts` — 상수 제거**

`export const PRIORITIES = ['긴급', '높음', '보통', '낮음'] as const;` 삭제.
`PRIORITY_COLORS` 블록(25-30행) 전체 삭제.

- [ ] **Step 3: `src/lib/custom-views.ts` — SortKey에서 priority 제거 + 저장된 뷰 정화**

파일 상단부를 다음으로 교체:

```ts
export type SortKey =
  | 'deadline'
  | 'created_at'
  | 'title'
  | 'requester'
  | 'source';

export const SORT_LABEL: Record<SortKey, string> = {
  created_at: '최근 추가',
  deadline: '마감일',
  title: '이름',
  requester: '요청자',
  source: '출처',
};

const SORT_KEYS: SortKey[] = [
  'created_at',
  'deadline',
  'title',
  'requester',
  'source',
];
```

`CustomTaskView`에서 `priorities: string[];` 행 삭제.

`loadViews`를 저장값 정화 버전으로 교체 (localStorage에 남은 `sortBy: 'priority'` 뷰가 깨지지 않게):

```ts
export function loadViews(page: 'inbox' | 'today'): CustomTaskView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw: (CustomTaskView & { sortBy?: string })[] =
      JSON.parse(localStorage.getItem(KEYS[page]) ?? '[]');
    // priority 정렬/필터는 폐기됨 — 옛 저장값은 created_at으로 강등.
    return raw.map(v => ({
      ...v,
      sortBy: isSortKey(v.sortBy ?? null) ? (v.sortBy as SortKey) : 'created_at',
    }));
  } catch {
    return [];
  }
}
```

(참고: `loadInboxSort`는 기존 `isSortKey` 가드 덕에 'priority' 저장값이 자동으로 'created_at' 폴백된다 — 수정 불필요.)

- [ ] **Step 4: `src/app/api/tasks/route.ts` — priority 파라미터/기본값 제거**

GET에서 9행 `const priority = searchParams.get('priority');` 와 27행 `if (priority) query = query.eq('priority', priority);` 삭제.
POST insert 객체에서 58행 `priority: body.priority ?? '보통',` 삭제.

- [ ] **Step 5: `src/app/page.tsx` — 필터 상태/로직 제거**

다음을 모두 적용:

1. 35행 `const [priority, setPriority] = useState('all');` 삭제
2. fetchTasks(96-112행)에서 `if (priority !== 'all') params.set('priority', priority);` 삭제, deps를 `[source]`로
3. 208행 `const priorityOrder: Record<string, number> = ...` 삭제
4. `noFilters`(221-226행)에서 `priority === 'all' &&` 삭제
5. treeFilteredTasks(227-242행)에서 `const prioOk = ...` 행과 조건의 `prioOk &&` 삭제, deps에서 `priority` 제거
6. getViewTasks(271-301행): `if ((view.priorities ?? []).length > 0) {...}` 블록 삭제, `const sort = view.sortBy ?? 'priority';` → `const sort = view.sortBy ?? 'created_at';`, `if (sort === 'priority') return ...priorityOrder...` 행 삭제
7. InboxFilterPopover JSX(380-395행)에서 `priority={priority}`, `onPriorityChange={setPriority}` 삭제
8. 초기화 버튼 조건(396행)에서 `priority !== 'all' ||` 삭제, onClick에서 `setPriority('all');` 삭제

- [ ] **Step 6: `src/components/tasks/inbox-filter-popover.tsx` — 우선순위 섹션 제거**

1. `SORT_OPTIONS`에서 `'priority',` 삭제
2. import에서 `PRIORITIES,` 삭제 (`import { SOURCES } from '@/lib/constants';`)
3. Props에서 `priority: string;`, `onPriorityChange: (v: string) => void;` 삭제 + 구조분해에서도 삭제
4. `activeCount`에서 `(priority !== 'all' ? 1 : 0) +` 삭제
5. `reset`에서 `onPriorityChange('all');` 삭제
6. `<Section label="우선순위">...</Section>` 블록(121-137행)과 바로 위 `<Separator />` 삭제

- [ ] **Step 7: `src/components/tasks/view-edit-form.tsx` — 우선순위 필터 제거**

1. import에서 `PRIORITIES,` 삭제 (`import { STATUS_COLORS } from '@/lib/constants';`)
2. `selectedPriorities` state, `togglePriority`, `priorityColors` 삭제
3. `handleSave`의 onSave 객체에서 `priorities: selectedPriorities,` 삭제
4. `sortBy` 초기값 `'priority'` → `'created_at'`
5. `{/* Priority filter */}` div 블록(88-111행) 전체 삭제
6. Select에서 `<SelectItem value="priority">우선순위</SelectItem>` 삭제

- [ ] **Step 8: `src/components/tasks/task-quick-capture.tsx` — priority chip 제거**

1. import에서 `Priority` 삭제 (`import { Task, Issue } from '@/lib/types';`), `PRIORITIES` import 행 삭제
2. `const [priority, setPriority] = useState<Priority>('보통');`, `const [priorityOpen, setPriorityOpen] = useState(false);` 삭제
3. `chipsTouched`를 `deadline !== null || issueId !== defaultIssueId;` 로
4. `resetChips`에서 `setPriority('보통');` 삭제
5. POST body에서 `priority,` 삭제
6. priority Popover 블록(181-210행) 전체 삭제

- [ ] **Step 9: `src/components/tasks/task-inline-editor.tsx` — priority chip 제거**

1. `const [priority, setPriority] = useState(task.priority);`(29행), `const [priorityOpen, setPriorityOpen] = useState(false);`(39행) 삭제
2. `{/* Priority chip */}` Popover 블록(191-226행) 전체 삭제
3. 파일 상단 import에서 `PRIORITIES` 제거 (사용처 없어짐 — eslint가 알려줌)

- [ ] **Step 10: `src/components/tasks/task-detail-panel.tsx` — 우선순위 Select 제거**

1. `const [priority, setPriority] = useState('');`(65행), `setPriority(taskData.priority);`(87행), `handlePriorityChange`(187-191행) 삭제
2. 450-471행의 2열 그리드를 상태 단독으로 교체:

```tsx
              <div>
                <Label className="text-xs text-muted-foreground">상태</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
```

3. import에서 `PRIORITIES` 제거

- [ ] **Step 11: `src/components/tasks/task-form.tsx` — 우선순위 필드 제거**

1. `PRIORITIES` import 행 삭제
2. form state에서 `priority: task?.priority ?? '보통',` 삭제
3. payload에서 `priority: form.priority,` 삭제
4. `<Label>우선순위</Label>` ~ `</Select>` 를 감싸는 `<div>`(111-119행) 삭제 — 그리드에는 상태만 남음

- [ ] **Step 12: `src/app/tasks/trash/page.tsx:142` — priority 뱃지 제거**

`<Badge variant="outline">{task.priority}</Badge>` 행 삭제.

- [ ] **Step 13: `src/components/inbox/inbox-tree.tsx` — priority 정렬 제거**

1. 60행 `const PRIORITY_ORDER: Record<string, number> = ...` 삭제
2. `sortNodes`에서 다음 분기(80-83행) 삭제:

```ts
    if (sortBy === 'priority') {
      const pa = PRIORITY_ORDER[ta.priority] ?? 9;
      const pb = PRIORITY_ORDER[tb.priority] ?? 9;
      if (pa !== pb) return pa - pb;
    } else if (sortBy === 'deadline') {
```
→ `if (sortBy === 'deadline') {` 로 시작하게.

- [ ] **Step 14: 잔재 검증**

```bash
grep -rn "priority\|PRIORITIES\|Priority" src --include="*.ts" --include="*.tsx" | grep -v "// Visual signal priority"
```

Expected: 출력 없음 (event-month-grid.tsx의 주석 1건만 grep -v로 걸러짐).

- [ ] **Step 15: 빌드 + 린트**

```bash
npm run build && npx eslint src --quiet
```

Expected: 빌드 성공, 신규 에러 0 (기존 react-hooks 에러 6건은 이번 작업과 무관 — 그대로 둠).

- [ ] **Step 16: 동작 확인 (dev 서버 + curl)**

```bash
npm run dev &  # 백그라운드
sleep 5
curl -s -X POST http://localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":"priority 제거 검증"}' | head -c 300
```

Expected: 201로 task JSON 반환, `priority` 키 없음. 확인 후 해당 task는 DELETE로 정리:

```bash
curl -s -X DELETE http://localhost:3000/api/tasks/<위에서 받은 id>
```

- [ ] **Step 17: Commit**

```bash
git add -A src
git commit -m "feat: 우선순위 필드 전면 제거 — 필터·정렬·폼·뱃지·API"
```

---

### Task 3: pending 백엔드 — 타입 + 목록 필터 + pend/unpend 라우트

**Files:**
- Modify: `src/lib/types.ts` (Task·Issue에 pending_at)
- Modify: `src/app/api/tasks/route.ts` (GET pending 필터)
- Modify: `src/app/api/issues/route.ts` (GET pending 필터)
- Modify: `src/app/api/tasks/[id]/restore/route.ts` (복구 시 보류 해제)
- Modify: `src/app/api/tasks/count/route.ts` (배지에서 보류 제외)
- Create: `src/app/api/tasks/[id]/pend/route.ts`
- Create: `src/app/api/tasks/[id]/unpend/route.ts`
- Create: `src/app/api/issues/[id]/pend/route.ts`
- Create: `src/app/api/issues/[id]/unpend/route.ts`

- [ ] **Step 1: `src/lib/types.ts` — pending_at 추가**

`Task` 인터페이스 `is_deleted: boolean;` 위에 `pending_at: string | null;` 추가.
`Issue` 인터페이스 `is_deleted: boolean;` 위에 `pending_at: string | null;` 추가.

- [ ] **Step 2: `src/app/api/tasks/route.ts` GET — pending 필터**

`const showDeleted = ...` 아래에 추가:

```ts
  const pendingOnly = searchParams.get('pending') === 'true';
```

`let query = ...eq('is_deleted', showDeleted);` 바로 아래에 추가:

```ts
  // 보류(pending_at) 필터 — 휴지통 조회(deleted=true)에서는 적용하지 않는다:
  // 보류 중이던 task를 삭제해도 휴지통에는 보여야 한다.
  if (!showDeleted) {
    if (pendingOnly) query = query.not('pending_at', 'is', null);
    else query = query.is('pending_at', null);
  }
```

- [ ] **Step 3: `src/app/api/issues/route.ts` GET — pending 필터**

GET 함수를 다음으로 교체 (NextRequest 파라미터 추가):

```ts
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const pendingOnly = request.nextUrl.searchParams.get('pending') === 'true';
  let query = supabase
    .from('issues')
    .select('*')
    .eq('is_deleted', false)
    .order('position', { ascending: true });
  // 기본은 보류 제외 — 인박스 트리·IssuePicker에서 보류된 ISSUE가 숨겨진다.
  query = pendingOnly
    ? query.not('pending_at', 'is', null)
    : query.is('pending_at', null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 4: 휴지통 복구 시 보류도 해제**

`src/app/api/tasks/[id]/restore/route.ts`의 update를:

```ts
    .update({ is_deleted: false, pending_at: null })
```

(spec 결정: 복구는 항상 인박스로 — 보류 상태 유지하지 않음.)

- [ ] **Step 5: 사이드바 카운트에서 보류 제외**

`src/app/api/tasks/count/route.ts`의 쿼리 체인에 `.is('pending_at', null)` 추가:

```ts
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .is('pending_at', null)
    .not('status', 'in', '("완료","취소","위임")');
```

- [ ] **Step 6: task pend 라우트 생성**

`src/app/api/tasks/[id]/pend/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 보류: task + 직계 sub-task 전체에 pending_at 설정.
// 3-level invariant (ISSUE > TASK > sub-TASK) 덕에 하위 전파는 직계 children
// 한 단계로 충분하다. restore/purge 라우트와 같은 POST-액션 패턴.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .update({ pending_at: now })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: childErr } = await supabase
    .from('tasks')
    .update({ pending_at: now })
    .eq('parent_task_id', id)
    .eq('is_deleted', false);
  if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 });

  return NextResponse.json(data);
}
```

- [ ] **Step 7: task unpend 라우트 생성**

`src/app/api/tasks/[id]/unpend/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 복귀: task + 직계 sub-task의 pending_at 해제. position·issue_id는 건드리지
// 않으므로 원래 자리(계층·순서)로 그대로 돌아간다.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ pending_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: childErr } = await supabase
    .from('tasks')
    .update({ pending_at: null })
    .eq('parent_task_id', id)
    .eq('is_deleted', false);
  if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 });

  return NextResponse.json(data);
}
```

- [ ] **Step 8: issue pend 라우트 생성**

`src/app/api/issues/[id]/pend/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ISSUE 통째 보류: issue + 소속 top-level task + 그 sub-task 전부.
// sub-task는 issue_id가 null인 경우가 있어 (AddSubTaskRow가 issue_id: null로
// 생성) parent_task_id in (top-level ids) 2차 업데이트가 필요하다.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data: issue, error } = await supabase
    .from('issues')
    .update({ pending_at: now })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: topTasks, error: listErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('issue_id', id)
    .eq('is_deleted', false);
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const ids = (topTasks ?? []).map((t: { id: string }) => t.id);
  if (ids.length > 0) {
    const { error: e1 } = await supabase
      .from('tasks').update({ pending_at: now }).in('id', ids);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabase
      .from('tasks').update({ pending_at: now })
      .in('parent_task_id', ids).eq('is_deleted', false);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json(issue);
}
```

- [ ] **Step 9: issue unpend 라우트 생성**

`src/app/api/issues/[id]/unpend/route.ts` — Step 8과 동일 구조, `{ pending_at: now }`를 모두 `{ pending_at: null }`로:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ISSUE 통째 복귀 — spec 결정: ISSUE 단위로만 복귀하며, ISSUE 보류 이전에
// 개별 보류돼 있던 task도 함께 복귀한다 (보류 출처를 구분하지 않는 단순화).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: issue, error } = await supabase
    .from('issues')
    .update({ pending_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: topTasks, error: listErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('issue_id', id)
    .eq('is_deleted', false);
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const ids = (topTasks ?? []).map((t: { id: string }) => t.id);
  if (ids.length > 0) {
    const { error: e1 } = await supabase
      .from('tasks').update({ pending_at: null }).in('id', ids);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabase
      .from('tasks').update({ pending_at: null })
      .in('parent_task_id', ids).eq('is_deleted', false);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json(issue);
}
```

- [ ] **Step 10: 빌드 + curl 검증**

```bash
npm run build
npm run dev &
sleep 5
# 검증용 task 생성 → 보류 → 목록에서 사라짐 → pending=true에 나타남 → 복귀
TASK_ID=$(curl -s -X POST http://localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":"pend 검증"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST http://localhost:3000/api/tasks/$TASK_ID/pend > /dev/null
curl -s "http://localhost:3000/api/tasks?deleted=false" | grep -c "$TASK_ID"   # Expected: 0
curl -s "http://localhost:3000/api/tasks?pending=true" | grep -c "$TASK_ID"    # Expected: 1
curl -s -X POST http://localhost:3000/api/tasks/$TASK_ID/unpend > /dev/null
curl -s "http://localhost:3000/api/tasks?deleted=false" | grep -c "$TASK_ID"   # Expected: 1
curl -s -X DELETE http://localhost:3000/api/tasks/$TASK_ID > /dev/null          # 정리
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/types.ts src/app/api
git commit -m "feat: pending 백엔드 — 목록 기본 제외 + pend/unpend 라우트 (task·issue)"
```

---

### Task 4: 보류 액션 UI — task 카드 메뉴 + ISSUE 메뉴 + 상세 패널

**Files:**
- Modify: `src/components/tasks/task-card.tsx` (드롭다운에 보류)
- Modify: `src/components/tasks/task-branch.tsx` (핸들러 전달)
- Modify: `src/components/issues/issue-row.tsx` (ISSUE 메뉴에 보류)
- Modify: `src/components/inbox/inbox-tree.tsx` (onPendIssue 전달)
- Modify: `src/app/page.tsx` (handlePend / handlePendIssue)
- Modify: `src/components/tasks/task-detail-panel.tsx` (보류 버튼)

- [ ] **Step 1: TaskCard에 onPend prop + 보류 메뉴**

`src/components/tasks/task-card.tsx`:

1. lucide import에 `PauseCircle` 추가
2. `TaskCardProps`의 `onSelect?: ...` 아래에 추가:

```ts
  /** 보류함으로 이동. 전달되지 않으면 메뉴에 보류 항목이 표시되지 않는다
   *  (Today·휴지통 등 보류 액션이 없는 화면). */
  onPend?: (taskId: string) => void;
```

3. 함수 시그니처 구조분해에 `onPend,` 추가
4. DropdownMenuContent에서 `위임` 항목 **위에** 추가:

```tsx
                {onPend && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onPend(task.id); }}
                  >
                    <PauseCircle className="h-4 w-4 mr-2" />
                    보류
                  </DropdownMenuItem>
                )}
```

- [ ] **Step 2: TaskBranch 핸들러 전달**

`src/components/tasks/task-branch.tsx`:

1. `TaskBranchHandlers`에 추가:

```ts
  onPend?: (id: string) => void;
```

2. `TaskBranch` 구조분해에 `onPend,` 추가 (onSelect 옆)
3. `renderChildren()`의 두 분기 모두에서 재귀 `<TaskBranch ...>`에 `onPend={onPend}` 추가 (2곳)
4. 본문 `<TaskCard ...>`에 `onPend={onPend}` 추가

- [ ] **Step 3: IssueRow에 보류 메뉴**

`src/components/issues/issue-row.tsx`:

1. lucide import에 `PauseCircle` 추가
2. `Props`에 `onPend?: () => void;` 추가, 구조분해에 `onPend,` 추가
3. DropdownMenuContent의 `편집` 항목 아래·`삭제` 위에 추가:

```tsx
              {onPend && (
                <DropdownMenuItem onClick={onPend}>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  보류
                </DropdownMenuItem>
              )}
```

- [ ] **Step 4: InboxTree 전달**

`src/components/inbox/inbox-tree.tsx`:

1. `Props`에 `onPendIssue: (issue: Issue) => void;` 추가 (onDeleteIssue 아래), 구조분해에도 추가
2. `<IssueRow ...>`에 `onPend={() => onPendIssue(issue)}` 추가

- [ ] **Step 5: 인박스 페이지 핸들러**

`src/app/page.tsx`:

1. 상단 import에 `import { toast } from 'sonner';` 추가
2. `handleDelete` 아래에 추가:

```ts
  const handlePend = async (taskId: string) => {
    // 낙관적 제거: 본인 + 직계 sub-task. 실패 시 fetchTasks로 원복.
    setTasks(prev => prev.filter(t => t.id !== taskId && t.parent_task_id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}/pend`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('task-updated'));
      toast('보류함으로 이동했어요', {
        action: {
          label: '되돌리기',
          onClick: async () => {
            await apiFetch(`/api/tasks/${taskId}/unpend`, { method: 'POST' });
            fetchTasks();
          },
        },
      });
    } catch {
      fetchTasks();
    }
  };

  const handlePendIssue = async (issue: Issue) => {
    setIssues(prev => prev.filter(i => i.id !== issue.id));
    setTasks(prev => prev.filter(t => t.issue_id !== issue.id));
    try {
      await apiFetch(`/api/issues/${issue.id}/pend`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('task-updated'));
      toast(`"${issue.name}" 전체를 보류함으로 옮겼어요`, {
        action: {
          label: '되돌리기',
          onClick: async () => {
            await apiFetch(`/api/issues/${issue.id}/unpend`, { method: 'POST' });
            fetchTasks();
          },
        },
      });
    } catch {
      fetchTasks();
    }
  };
```

3. `taskHandlers` 객체에 `onPend: handlePend,` 추가
4. `<InboxTree ...>`에 `onPendIssue={handlePendIssue}` 추가

- [ ] **Step 6: 상세 패널에 보류 버튼**

`src/components/tasks/task-detail-panel.tsx` — 삭제 버튼 옆에 보류 추가. `confirmDelete` 를 setState하는 삭제 버튼(`setConfirmDelete(true)` 검색)을 찾아 그 **앞에** 추가:

```tsx
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  if (!taskId) return;
                  await apiFetch(`/api/tasks/${taskId}/pend`, { method: 'POST' });
                  window.dispatchEvent(new CustomEvent('task-updated'));
                  onTaskUpdated?.();
                  onClose();
                }}
              >
                <PauseCircle className="h-4 w-4 mr-1" />
                보류
              </Button>
```

lucide import에 `PauseCircle` 추가. (`onTaskUpdated`/`onClose` prop 이름은 이 파일의 기존 prop 시그니처를 따른다 — page.tsx:639-644에서 `onClose`/`onTaskUpdated`로 호출되고 있음.)

- [ ] **Step 7: 빌드 + 수동 확인**

```bash
npm run build && npx eslint src --quiet
```

dev 서버에서 `/` 열고: task 카드 ⋯ 메뉴에 "보류" 표시 → 클릭 시 카드가 사라지고 토스트 + 되돌리기 동작, ISSUE ⋯ 메뉴 "보류" → ISSUE 통째로 사라짐. `/today`의 카드 메뉴에는 보류가 **없어야** 함 (onPend 미전달).

- [ ] **Step 8: Commit**

```bash
git add src/components src/app/page.tsx
git commit -m "feat: 보류 액션 — task 카드 메뉴·ISSUE 메뉴·상세 패널"
```

---

### Task 5: 보류함 페이지 + 사이드바 메뉴

**Files:**
- Create: `src/app/pending/page.tsx`
- Modify: `src/lib/nav-items.ts`

- [ ] **Step 1: nav-items에 보류함 추가**

`src/lib/nav-items.ts` — lucide import에 `PauseCircle` 추가, 마지막 그룹을:

```ts
  { separator: true },
  { href: '/pending', label: '보류함', icon: PauseCircle },
  { href: '/tasks/trash', label: '휴지통', icon: Trash2 },
```

- [ ] **Step 2: 보류함 페이지 생성**

`src/app/pending/page.tsx` (휴지통 페이지 패턴 — Card 리스트 + ConfirmDialog 없이 즉시 복귀):

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Issue, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, PauseCircle, FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskListSkeleton } from '@/components/loading/page-skeleton';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function PendingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [taskData, issueData] = await Promise.all([
        apiFetch<Task[]>('/api/tasks?pending=true'),
        apiFetch<Issue[]>('/api/issues?pending=true'),
      ]);
      setTasks(taskData);
      setIssues(issueData);
    } catch {
      // apiFetch가 토스트 처리
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUnpendTask = async (id: string) => {
    try {
      await apiFetch(`/api/tasks/${id}/unpend`, { method: 'POST' });
      toast.success('인박스로 복귀했어요');
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchAll();
    } catch {}
  };

  const handleUnpendIssue = async (issue: Issue) => {
    try {
      await apiFetch(`/api/issues/${issue.id}/unpend`, { method: 'POST' });
      toast.success(`"${issue.name}" 전체가 인박스로 복귀했어요`);
      window.dispatchEvent(new CustomEvent('task-updated'));
      fetchAll();
    } catch {}
  };

  if (loading) return <TaskListSkeleton />;

  // ISSUE 묶음으로 보류된 것과 개별 보류를 분리해서 표시.
  // sub-task는 issue_id가 null일 수 있어 부모를 따라 ISSUE 묶음에 귀속시킨다.
  const pendingIssueIds = new Set(issues.map(i => i.id));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const belongsToPendingIssue = (t: Task): boolean => {
    if (t.issue_id && pendingIssueIds.has(t.issue_id)) return true;
    const parent = t.parent_task_id ? taskById.get(t.parent_task_id) : undefined;
    return !!(parent?.issue_id && pendingIssueIds.has(parent.issue_id));
  };
  const issueTaskCount = (issueId: string) =>
    tasks.filter(t =>
      t.issue_id === issueId ||
      (t.parent_task_id && taskById.get(t.parent_task_id)?.issue_id === issueId),
    ).length;
  const individualTasks = tasks.filter(t => !belongsToPendingIssue(t));
  // 개별 보류 중 sub-task는 부모가 같이 보류된 경우 부모 카드로 묶이므로 숨김.
  const individualTop = individualTasks.filter(
    t => !t.parent_task_id || !individualTasks.some(p => p.id === t.parent_task_id),
  );
  const childrenOf = (id: string) =>
    individualTasks.filter(t => t.parent_task_id === id);

  const isEmpty = issues.length === 0 && tasks.length === 0;

  return (
    <div className="space-y-3">
      {!isEmpty && (
        <p className="text-xs text-muted-foreground">
          {issues.length > 0 && `ISSUE ${issues.length}개`}
          {issues.length > 0 && individualTop.length > 0 && ' · '}
          {individualTop.length > 0 && `task ${individualTop.length}개`}
          {' '}보류 중 · 복귀하면 원래 자리로 돌아가요.
        </p>
      )}

      {isEmpty && (
        <EmptyState
          icon={PauseCircle}
          title="보류함이 비어있어요"
          description="인박스에서 task나 ISSUE의 ⋯ 메뉴 → 보류로 치워둘 수 있어요"
        />
      )}

      {issues.map(issue => (
        <Card key={issue.id} className="shadow-none">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden />
                <Badge variant="outline" className="text-[10px] font-semibold tracking-wide px-1.5 h-4 rounded-sm bg-primary/10 text-primary border-primary/20">
                  ISSUE
                </Badge>
              </div>
              <p className="font-medium truncate">{issue.name}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                task {issueTaskCount(issue.id)}개
                {issue.pending_at && ` · ${formatDate(issue.pending_at, 'M월 d일')} 보류`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleUnpendIssue(issue)} className="shrink-0">
              <RotateCcw className="h-4 w-4 mr-1" />
              통째로 복귀
            </Button>
          </CardContent>
        </Card>
      ))}

      {individualTop.map(task => {
        const subs = childrenOf(task.id);
        return (
          <Card key={task.id} className="shadow-none">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{task.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {subs.length > 0 && `하위 ${subs.length}개 · `}
                  {task.pending_at && `${formatDate(task.pending_at, 'M월 d일')} 보류`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnpendTask(task.id)} className="shrink-0">
                <RotateCcw className="h-4 w-4 mr-1" />
                복귀
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 수동 확인**

```bash
npm run build
```

dev 서버에서: 사이드바에 "보류함" 메뉴 → 인박스에서 task 하나 보류 → 보류함 페이지에 카드 표시 → "복귀" 클릭 → 인박스 원래 자리(같은 ISSUE 아래)로 돌아오는지 확인. ISSUE 보류 → 보류함에 ISSUE 카드 + task 수 → "통째로 복귀" 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/pending src/lib/nav-items.ts
git commit -m "feat: 보류함 페이지 + 사이드바 메뉴"
```

---

### Task 6: 무게 인박스 — 마감일 기반 시각 위계

**Files:**
- Create: `src/lib/task-weight.ts`
- Modify: `src/components/tasks/task-card.tsx`

- [ ] **Step 1: 무게 판정 헬퍼 생성**

`src/lib/task-weight.ts`:

```ts
/**
 * 마감일 기반 시각 무게. priority 필드 폐기 후 인박스의 유일한 위계 기준.
 *  - heavy : 마감 지남 또는 오늘 → 크고 진하게 + 키컬러 라인
 *  - normal: 마감이 오늘+7일 이내
 *  - light : 마감 없음 또는 7일 초과 → 작고 흐리게
 * 처리된(완료/위임/취소) task는 기존 line-through 처리가 우선이므로
 * 호출부에서 isTaskDone일 때 'normal'로 고정해 무게 스타일을 끈다.
 */
export type TaskWeight = 'heavy' | 'normal' | 'light';

export function getTaskWeight(deadline: string | null): TaskWeight {
  if (!deadline) return 'light';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'heavy';
  if (diffDays <= 7) return 'normal';
  return 'light';
}
```

- [ ] **Step 2: TaskCard에 무게 적용**

`src/components/tasks/task-card.tsx`:

1. import 추가: `import { getTaskWeight } from '@/lib/task-weight';`
2. `const isDone = isTaskDone(task.status);` 아래에:

```ts
  // 마감일 기반 무게 — 처리된 task는 line-through가 우선이므로 normal 고정.
  const weight = isDone ? 'normal' : getTaskWeight(task.deadline);
```

3. heavy 왼쪽 키컬러 라인 — 기존 editing 인디케이터(131행)를 다음으로 교체:

```tsx
      {(editing || (weight === 'heavy' && !isSubtask)) && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}
```

4. 제목 className(266-275행)을 다음으로 교체:

```tsx
              <span
                className={cn(
                  'leading-snug truncate tracking-[-0.012em]',
                  isSubtask
                    ? 'text-[13px] font-normal text-foreground/80'
                    : weight === 'heavy'
                      ? 'text-[15px] font-bold text-foreground'
                      : weight === 'light'
                        ? 'text-[13px] font-normal text-foreground/60'
                        : hasChildren
                          ? 'text-[14.5px] font-semibold text-foreground'
                          : 'text-[14px] font-medium text-foreground',
                  isDone && 'line-through text-muted-foreground',
                )}
                title={task.title}
              >
```

5. heavy 마감 메타 강조 — 마감 표시 span(283-288행)을:

```tsx
              {task.deadline && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    weight === 'heavy' && !isDone && 'text-primary font-medium',
                  )}
                >
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {formatDate(task.deadline, 'M월 d일')}{deadlineSuffix}
                </span>
              )}
```

- [ ] **Step 3: 빌드 + 시각 확인**

```bash
npm run build && npx eslint src/components/tasks/task-card.tsx src/lib/task-weight.ts
```

dev 서버 `/`에서 확인 체크리스트:
- 마감 오늘/지남 task → 크고 굵은 제목 + 보라 왼쪽 라인 + 보라 날짜
- 마감 3일 뒤 → 기존과 동일한 보통 카드
- 마감 없음 / 8일 뒤 → 작고 흐린 제목
- 완료 task → line-through만, 무게 스타일 없음
- sub-task → 기존 스타일 유지 (무게 미적용)

- [ ] **Step 4: Commit**

```bash
git add src/lib/task-weight.ts src/components/tasks/task-card.tsx
git commit -m "feat: 무게 인박스 — 마감일 기반 heavy/normal/light 시각 위계"
```

---

### Task 7: 문서화 + 최종 통합 검증

**Files:**
- Create: `docs/architecture/pending.md`
- Modify: `CLAUDE.md` (아키텍처 표에 1행)

- [ ] **Step 1: 아키텍처 문서 작성**

`docs/architecture/pending.md`:

```markdown
# 보류함 (Pending)

## Invariant

- `tasks.pending_at` / `issues.pending_at` (timestamptz, null = 활성) — 휴지통
  `is_deleted`와 동일한 soft-flag 패턴. 두 플래그는 직교하며 `is_deleted` 우선
  (삭제된 task는 보류함에도 안 보임).
- status(등록/완료/위임/취소)와도 직교 — 보류 중에도 status 변경 가능
  (예: Notion sync가 보류된 task를 완료 처리해도 보류 유지).
- 보류 전파는 직계 children 한 단계 (3-level invariant 덕분).
  task pend → 본인 + `parent_task_id = id`.
  issue pend → issue + `issue_id = id` + `parent_task_id in (그 ids)`
  (sub-task는 issue_id가 null일 수 있어 2차 업데이트 필수).
- ISSUE는 통째로만 복귀 — 개별 task 꺼내기 불가. ISSUE 복귀 시 이전에 개별
  보류됐던 task도 같이 복귀 (보류 출처 비구분 단순화, spec 2026-06-03).
- 복귀는 position/issue_id를 건드리지 않음 → 원래 자리 복원.
- 휴지통 복구(restore)는 pending_at도 null로 — 복구는 항상 인박스로.

## 쿼리 계약

- `GET /api/tasks` 기본 = `pending_at is null` (단, `deleted=true`면 pending
  필터 미적용 — 휴지통은 보류 여부 무관하게 표시).
- `GET /api/tasks?pending=true` = 보류만. `GET /api/issues?pending=true` 동일.
- `/api/tasks/count` (사이드바 배지)도 보류 제외.
- 보류/복귀 액션: `POST /api/tasks/[id]/pend|unpend`,
  `POST /api/issues/[id]/pend|unpend` (restore/purge와 같은 POST-액션 패턴).

## 무게 인박스 (관련)

- priority 필드는 2026-06-03 전면 폐기. 시각 위계는 `src/lib/task-weight.ts`의
  `getTaskWeight(deadline)` 단일 기준: 지남·오늘=heavy / +7일 이내=normal /
  없음·초과=light. 처리된 task는 line-through가 우선 (무게 끔).
- 적용 위치는 TaskCard 한 곳 (제목 클래스 + 왼쪽 키컬러 라인 + 마감 메타).
```

- [ ] **Step 2: CLAUDE.md 아키텍처 표에 행 추가**

`CLAUDE.md`의 아키텍처 참조 문서 표 마지막에:

```markdown
| `docs/architecture/pending.md` | 보류함 pending_at soft-flag invariant, pend/unpend 전파 규칙, 무게 인박스(getTaskWeight) 기준. |
```

- [ ] **Step 3: 전체 빌드 + 린트 최종**

```bash
npm run build && npx eslint src --quiet
```

Expected: 빌드 성공. eslint 에러는 기존 6건(react-hooks — history/gcal 파일)만.

- [ ] **Step 4: 통합 시나리오 검증 (dev 서버)**

```bash
npm run dev &
sleep 5
```

체크리스트 (브라우저):
1. `/` — task 보류 → 사라짐 + 사이드바 인박스 배지 감소
2. `/today` — 보류한 task가 오늘 목록에서도 사라짐
3. `/pending` — 보류 task 표시, 복귀 → `/` 원래 ISSUE 아래로
4. ISSUE 보류 → 트리에서 ISSUE 헤더째 사라짐 → `/pending`에서 통째 복귀
5. 보류 task 삭제(보류함에서는 불가하므로 복귀 후 삭제) → 휴지통 표시 → 복구 → 인박스(보류 아님)
6. 마감일별 무게 렌더 확인 (Task 6 Step 3 체크리스트)
7. 필터 팝오버에 우선순위 섹션 없음, 정렬 5종

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/pending.md CLAUDE.md
git commit -m "docs: 보류함 invariant + 무게 인박스 기준 문서화"
```

---

## Self-Review 체크 (플랜 작성 후 수행 완료)

- **Spec coverage**: §1 보류함 → Task 1,3,4,5 / §2 priority 제거 → Task 1,2 / §3 무게 → Task 6 (ISSUE 헤더 진행률은 기구현 — 헤더에 명시) / 테스트 포인트 → Task 3 Step 10, Task 7 Step 4
- **타입 일관성**: `pending_at: string | null`(types) ↔ timestamptz(DB) ↔ `pending=true` 쿼리 파람 ↔ `onPend`/`onPendIssue` 핸들러 명칭 일관
- **순서 의존성**: Task 1(DB) → Task 2(코드의 priority 참조 제거; DB drop 후 POST가 깨지는 시간을 최소화하기 위해 연달아 실행) → Task 3 이후는 순차
