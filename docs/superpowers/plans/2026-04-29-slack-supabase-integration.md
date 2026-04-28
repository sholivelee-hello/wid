# Slack + Supabase 실연동 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mock 데이터 전체 제거, Supabase 실연결, Slack 이모지 → WID task 자동 생성 E2E 동작

**Architecture:** `isMockMode()` 분기 제거. Issues/Tasks/Settings API 전부 Supabase 직통. GCal은 빈 상태(미연결) 처리. Slack webhook은 기존 구현 그대로 유지. GCalEvent/CalendarSubscription 타입은 types.ts로 이전 후 mock 파일 삭제.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + supabase-js v2), Slack Events API, ngrok

---

## 파일 변경 지도

| 파일 | 작업 |
|---|---|
| `supabase/migrations/002_hierarchy_and_issues.sql` | 신규 생성 — issues 테이블 + tasks 누락 컬럼 |
| `src/lib/types.ts` | GCalEvent, CalendarSubscription 타입 추가 |
| `src/lib/gcal-events.ts` | import 경로 mock-gcal → types |
| `src/lib/calendar-view-state.ts` | import 경로 mock-calendars → types |
| `src/app/api/issues/route.ts` | Supabase로 전면 교체 |
| `src/app/api/issues/[id]/route.ts` | Supabase로 전면 교체 |
| `src/app/api/issues/[id]/tasks/route.ts` | Supabase로 전면 교체 |
| `src/app/api/tasks/route.ts` | mock 분기 제거 |
| `src/app/api/tasks/[id]/route.ts` | mock 분기 제거 |
| `src/app/api/tasks/[id]/restore/route.ts` | mock 분기 제거 |
| `src/app/api/tasks/count/route.ts` | mock 분기 제거 |
| `src/app/api/settings/notion-mapping/route.ts` | mock 분기 제거 |
| `src/app/api/gcal/events/route.ts` | 빈 배열 반환 |
| `src/app/api/gcal/calendars/route.ts` | 빈 배열 반환 |
| `src/lib/mock-data.ts` | 삭제 |
| `src/lib/mock-gcal.ts` | 삭제 |
| `src/lib/mock-calendars.ts` | 삭제 |
| `src/lib/mock-issues.ts` | 삭제 |
| `.env.local` | 실제 자격증명으로 업데이트 |

---

## Task 1: [사용자 직접] Supabase 프로젝트 생성

**Files:** 없음 (사용자 액션)

- [ ] [supabase.com](https://supabase.com) 로그인 → **New project** 클릭
- [ ] 이름: `wid`, 비밀번호 기록, 지역: **Northeast Asia (Tokyo)** 선택 → Create project
- [ ] 생성 완료 대기 (약 1분)
- [ ] **Settings → API** 메뉴로 이동 → 아래 3가지 복사:
  - `Project URL` (예: `https://abcxyz.supabase.co`)
  - `anon` `public` 키 (길고 긴 문자열)
  - `service_role` 키 (secret — **절대 공유 금지**)
- [ ] 복사한 3가지 값을 Claude에게 전달

---

## Task 2: .env.local 업데이트

**Files:**
- Modify: `.env.local`

- [ ] 사용자가 전달한 값으로 `.env.local`의 Supabase 항목 채우기:

```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public 키>
SUPABASE_SERVICE_ROLE_KEY=<service_role 키>
```

- [ ] 나머지 항목은 Slack 설정 전까지 유지:

```
SLACK_SIGNING_SECRET=<Task 9에서 채움>
SLACK_BOT_TOKEN=<Task 9에서 채움>
SLACK_TRIGGER_EMOJI=send-away
NEXT_PUBLIC_SLACK_TRIGGER_EMOJI=send-away
SLACK_COMPLETE_EMOJI=완료
NEXT_PUBLIC_SLACK_COMPLETE_EMOJI=완료
```

- [ ] 개발 서버 재시작: `npm run dev`
- [ ] 브라우저에서 앱 열어 콘솔 에러 없음 확인 (아직 테이블 없으므로 500 에러는 정상)

---

## Task 3: DB 스키마 완성

**Files:**
- Create: `supabase/migrations/002_hierarchy_and_issues.sql`

기존 `001_initial_schema.sql`에 issues 테이블과 tasks 누락 컬럼이 없음. 002로 보완.

- [ ] `supabase/migrations/002_hierarchy_and_issues.sql` 파일 생성:

```sql
-- Issues table
create table if not exists issues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  deadline timestamptz,
  sort_mode text not null default 'checklist' check (sort_mode in ('checklist', 'sequential')),
  position integer not null default 0,
  notion_issue_id text unique,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

-- Add missing columns to tasks
alter table tasks
  add column if not exists issue_id uuid references issues(id) on delete set null,
  add column if not exists parent_task_id uuid references tasks(id) on delete set null,
  add column if not exists sort_mode text not null default 'checklist',
  add column if not exists position integer not null default 0;

-- Fix status default and constraint
alter table tasks alter column status set default '등록';
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('등록', '진행중', '대기중', '완료', '위임', '취소'));

-- Indexes
create index if not exists idx_issue_position on issues(position) where not is_deleted;
create index if not exists idx_task_issue_id on tasks(issue_id) where not is_deleted;
create index if not exists idx_task_parent_id on tasks(parent_task_id) where not is_deleted;
create index if not exists idx_task_position on tasks(position);
```

- [ ] **Supabase 대시보드 → SQL Editor** 열기
- [ ] `001_initial_schema.sql` 전체 내용 붙여넣기 → **Run**
- [ ] `002_hierarchy_and_issues.sql` 전체 내용 붙여넣기 → **Run**
- [ ] **Table Editor** 탭에서 `tasks`, `issues`, `slack_events` 테이블 생성 확인
- [ ] 커밋:

```bash
git add supabase/migrations/002_hierarchy_and_issues.sql
git commit -m "feat(db): issues 테이블 + tasks 계층 컬럼 마이그레이션 추가"
```

---

## Task 4: 타입 이전 (mock 파일 의존성 제거 준비)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/gcal-events.ts`
- Modify: `src/lib/calendar-view-state.ts`

`gcal-events.ts`와 `calendar-view-state.ts`가 mock 파일에서 타입만 import 중. 타입을 `types.ts`로 이전.

- [ ] `src/lib/types.ts` 끝에 두 타입 추가:

```typescript
export interface GCalEvent {
  id: string;
  calendarId: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM (timed events only)
  endTime?: string;
  location?: string;
  attendees?: string[];
  meetLink?: string;
}

export interface CalendarSubscription {
  id: string;
  name: string;
  defaultColor: string;
}
```

- [ ] `src/lib/gcal-events.ts` 상단 import 수정:

```typescript
// 기존
import type { GCalEvent } from './mock-gcal';
// 변경
import type { GCalEvent } from './types';
```

- [ ] `src/lib/calendar-view-state.ts` 상단 import 수정:

```typescript
// 기존
import type { CalendarSubscription } from './mock-calendars';
// 변경
import type { CalendarSubscription } from './types';
```

- [ ] `npm run build 2>&1 | grep -E "error|Error"` 로 타입 에러 없음 확인

---

## Task 5: Issues API — Supabase로 교체

**Files:**
- Modify: `src/app/api/issues/route.ts`
- Modify: `src/app/api/issues/[id]/route.ts`
- Modify: `src/app/api/issues/[id]/tasks/route.ts`

현재 issues API는 Supabase 코드가 전혀 없음. 전면 교체.

- [ ] `src/app/api/issues/route.ts` 전체 교체:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('is_deleted', false)
    .order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const { data: last } = await supabase
    .from('issues')
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  const position = (last?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from('issues')
    .insert({
      name: body.name,
      deadline: body.deadline ?? null,
      sort_mode: body.sort_mode ?? 'checklist',
      position,
      notion_issue_id: body.notion_issue_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] `src/app/api/issues/[id]/route.ts` 전체 교체:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
  if (error) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const patch = await req.json();
  const supabase = createServerSupabaseClient();
  const allowed = ['name', 'deadline', 'sort_mode', 'position', 'notion_issue_id'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }
  const { data, error } = await supabase
    .from('issues')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cascade = new URL(req.url).searchParams.get('cascade') ?? 'detach';
  const supabase = createServerSupabaseClient();
  if (cascade === 'delete') {
    const { data: direct } = await supabase
      .from('tasks')
      .select('id')
      .eq('issue_id', id)
      .eq('is_deleted', false);
    if (direct && direct.length > 0) {
      const ids = direct.map((t: { id: string }) => t.id);
      await supabase.from('tasks').update({ is_deleted: true }).in('parent_task_id', ids);
      await supabase.from('tasks').update({ is_deleted: true }).in('id', ids);
    }
  } else {
    await supabase.from('tasks').update({ issue_id: null }).eq('issue_id', id);
  }
  await supabase.from('issues').update({ is_deleted: true }).eq('id', id);
  return NextResponse.json({ ok: true, cascade });
}
```

- [ ] `src/app/api/issues/[id]/tasks/route.ts` 전체 교체:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data: direct, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('issue_id', id)
    .eq('is_deleted', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const directIds = direct.map((t: { id: string }) => t.id);
  const { data: subs } = directIds.length > 0
    ? await supabase.from('tasks').select('*').in('parent_task_id', directIds).eq('is_deleted', false)
    : { data: [] };
  return NextResponse.json([...direct, ...(subs ?? [])]);
}
```

- [ ] `GET /api/issues` 호출해서 빈 배열 `[]` 반환 확인

---

## Task 6: Tasks/Settings API — mock 분기 제거

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Modify: `src/app/api/tasks/[id]/restore/route.ts`
- Modify: `src/app/api/tasks/count/route.ts`
- Modify: `src/app/api/settings/notion-mapping/route.ts`

각 파일에서 `if (isMockMode()) { ... }` 블록과 mock import 제거. Supabase 코드만 남김.

- [ ] `src/app/api/tasks/route.ts` — 상단 mock import 및 mock 관련 코드(tasks 배열, normalizeDepth, ALLOWED_STATUSES 루프, `__tasksRef` export 등) 전부 제거. `isMockMode()` 블록 제거. Supabase 분기만 남김. `isValidTaskParent`, `hasChildTasks` 함수는 유지(Supabase용 guard로 재사용 가능하면 유지, 아니면 삭제).

  구체적으로 삭제할 라인들:
  ```typescript
  // 삭제
  import { isMockMode, MOCK_TASKS } from '@/lib/mock-data';
  const tasks: typeof MOCK_TASKS = [...MOCK_TASKS];
  export const __tasksRef = () => tasks;
  function normalizeDepth(...) { ... }
  normalizeDepth(tasks);
  const ALLOWED_STATUSES = ...
  for (const t of tasks) { ... }
  // GET/POST 안의 if (isMockMode()) { ... } 블록
  ```

- [ ] `src/app/api/tasks/[id]/route.ts` — mock import 및 `if (isMockMode())` 블록 제거. `__tasksRef` import 제거. Supabase 분기만 남김.

- [ ] `src/app/api/tasks/[id]/restore/route.ts` — mock import 및 `if (isMockMode())` 블록 제거. Supabase 코드만 남김.

- [ ] `src/app/api/tasks/count/route.ts` — 전체 교체:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .not('status', 'in', '("완료","취소","위임")');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ active: count ?? 0 });
}
```

- [ ] `src/app/api/settings/notion-mapping/route.ts` — mock import 및 `if (isMockMode())` 블록 제거.

- [ ] `npm run build 2>&1 | grep -E "error TS|Error"` 로 타입 에러 없음 확인

---

## Task 7: GCal API — 빈 상태로 교체

**Files:**
- Modify: `src/app/api/gcal/events/route.ts`
- Modify: `src/app/api/gcal/calendars/route.ts`

- [ ] `src/app/api/gcal/events/route.ts` 전체 교체:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([]);
}
```

- [ ] `src/app/api/gcal/calendars/route.ts` 전체 교체:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([]);
}
```

---

## Task 8: Mock 파일 삭제

**Files:**
- Delete: `src/lib/mock-data.ts`
- Delete: `src/lib/mock-gcal.ts`
- Delete: `src/lib/mock-calendars.ts`
- Delete: `src/lib/mock-issues.ts`

- [ ] 4개 파일 삭제:

```bash
rm src/lib/mock-data.ts src/lib/mock-gcal.ts src/lib/mock-calendars.ts src/lib/mock-issues.ts
```

- [ ] `npm run build 2>&1 | grep -E "error TS|Cannot find module"` — 남은 import 참조 에러 확인
- [ ] 에러 나는 파일이 있으면 해당 import 제거 후 재확인
- [ ] 커밋:

```bash
git add -A
git commit -m "feat: mock 데이터 전체 제거 + Supabase 실연결"
```

---

## Task 9: [사용자 직접] Slack 앱 생성

**Files:** 없음 (사용자 액션)

- [ ] [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
- [ ] App Name: `WID`, Workspace: 본인 워크스페이스 선택 → Create App
- [ ] 왼쪽 메뉴 **OAuth & Permissions** → **Bot Token Scopes** → **Add an OAuth Scope** 클릭:
  - `channels:history` 추가
  - `groups:history` 추가
  - `users:read` 추가
- [ ] 같은 페이지 상단 **Install to Workspace** → Allow
- [ ] **Bot User OAuth Token** (`xoxb-...`) 복사
- [ ] 왼쪽 메뉴 **Basic Information** → **App Credentials** → **Signing Secret** 복사
- [ ] 두 값을 Claude에게 전달

---

## Task 10: [사용자 직접] ngrok 설치 및 실행

**Files:** 없음 (사용자 액션)

- [ ] 터미널에서 ngrok 설치:

```bash
brew install ngrok/ngrok/ngrok
```

- [ ] 개발 서버가 실행 중인지 확인 (`npm run dev`)
- [ ] 새 터미널 탭에서:

```bash
ngrok http 3000
```

- [ ] 출력에서 `Forwarding` 줄의 `https://xxxx.ngrok-free.app` URL 복사
- [ ] URL을 Claude에게 전달 (이 URL은 ngrok 재시작 시 바뀜)

---

## Task 11: Slack 환경변수 입력 + Webhook URL 등록

**Files:**
- Modify: `.env.local`

- [ ] `.env.local`의 Slack 항목 업데이트:

```
SLACK_SIGNING_SECRET=<Task 9에서 복사한 Signing Secret>
SLACK_BOT_TOKEN=<Task 9에서 복사한 Bot Token>
```

- [ ] 개발 서버 재시작: `npm run dev`
- [ ] [api.slack.com/apps](https://api.slack.com/apps) → 앱 선택 → **Event Subscriptions** → Enable Events **On**
- [ ] **Request URL** 칸에 입력:

```
https://<ngrok URL>/api/slack/webhook
```

- [ ] Slack이 "Verified ✓" 표시할 때까지 대기 (webhook이 challenge 자동 응답)
- [ ] **Subscribe to bot events** → **Add Bot User Event** → `reaction_added` 추가 → **Save Changes**
- [ ] 앱 재설치 필요 시 **OAuth & Permissions** → **Reinstall to Workspace**

---

## Task 12: E2E 테스트

**Files:** 없음 (검증)

- [ ] WID 앱 열기 → 인박스 비어있음 확인 (가짜 데이터 없음)
- [ ] Slack 워크스페이스 열기 → 아무 메시지에 `:send-away:` 이모지 리액션 추가
- [ ] 30초 내 WID 인박스 새로고침 → 해당 메시지 제목으로 task 생성 확인
- [ ] 같은 메시지에 `:완료:` 이모지 리액션 추가
- [ ] WID에서 해당 task 상태 '완료' 로 변경 확인
- [ ] Supabase **Table Editor → tasks** 에서 데이터 직접 확인
- [ ] `/settings` → Slack 연동 섹션 → **테스트 전송** → 정상 응답 확인
