# WID (Work Diary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개인 업무일지 웹 앱 — 노션/슬랙 연동, 타이머, 일별/주별/월별 대시보드

**Architecture:** Next.js 14+ App Router로 프론트+백 통합. Supabase(PostgreSQL)를 DB로 사용하고, API Routes로 슬랙 웹훅과 노션 동기화를 처리. Zustand로 타이머 상태를 클라이언트에서 관리.

**Tech Stack:** Next.js 14+, Tailwind CSS, shadcn/ui, Recharts, Supabase, Zustand, Vercel

**Spec:** `docs/superpowers/specs/2026-04-14-wid-work-diary-design.md`

---

## File Structure

```
wid/
├── .env.local                          # Supabase, Notion, Slack 키
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # DB 스키마 + 인덱스
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 루트 레이아웃 (사이드바 포함)
│   │   ├── page.tsx                    # 일별 대시보드 (메인)
│   │   ├── weekly/page.tsx             # 주별 뷰
│   │   ├── monthly/page.tsx            # 월별 뷰
│   │   ├── tasks/
│   │   │   ├── page.tsx                # 일감 목록
│   │   │   ├── new/page.tsx            # 일감 등록
│   │   │   ├── [id]/page.tsx           # 일감 상세/수정
│   │   │   └── trash/page.tsx          # 휴지통
│   │   ├── settings/page.tsx           # 설정
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts            # GET 목록, POST 생성
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET 상세, PATCH 수정, DELETE 삭제
│   │       │       ├── restore/route.ts
│   │       │       └── timer/
│   │       │           ├── start/route.ts
│   │       │           └── stop/route.ts
│   │       │       └── timelogs/route.ts  # GET 타이머 이력
│   │       ├── notion/sync/route.ts
│   │       ├── slack/webhook/route.ts
│   │       ├── stats/
│   │       │   ├── daily/route.ts
│   │       │   ├── weekly/route.ts
│   │       │   └── monthly/route.ts
│   │       ├── custom-statuses/
│   │       │   ├── route.ts            # GET, POST
│   │       │   └── [id]/route.ts       # PATCH, DELETE
│   │       └── settings/
│   │           └── notion-mapping/route.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # 브라우저용 클라이언트
│   │   │   └── server.ts              # 서버용 클라이언트
│   │   ├── types.ts                    # TypeScript 타입 정의
│   │   ├── constants.ts                # 상태, 우선순위 상수
│   │   └── utils.ts                    # 유틸리티 함수
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── header.tsx
│   │   ├── tasks/
│   │   │   ├── task-card.tsx
│   │   │   ├── task-form.tsx
│   │   │   ├── task-list.tsx
│   │   │   ├── task-filters.tsx
│   │   │   └── timer-button.tsx
│   │   ├── dashboard/
│   │   │   ├── summary-cards.tsx
│   │   │   ├── timeline-chart.tsx
│   │   │   ├── heatmap-calendar.tsx
│   │   │   ├── priority-pie-chart.tsx
│   │   │   ├── source-pie-chart.tsx
│   │   │   ├── duration-bar-chart.tsx
│   │   │   ├── trend-line-chart.tsx
│   │   │   └── date-navigator.tsx
│   │   └── settings/
│   │       ├── custom-status-manager.tsx
│   │       ├── notion-mapping.tsx
│   │       └── slack-settings.tsx
│   └── store/
│       └── timer-store.ts              # Zustand 타이머 상태
```

---

## Phase 1: 프로젝트 초기 설정

### Task 1: Next.js 프로젝트 생성 및 의존성 설치

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@latest wid --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: 추가 의존성 설치**

```bash
cd wid
npm install @supabase/supabase-js zustand recharts date-fns
npm install -D @types/node
```

- [ ] **Step 3: shadcn/ui 초기화**

```bash
npx shadcn@latest init
```

설정: TypeScript, style=default, base color=slate, CSS variables=yes

- [ ] **Step 4: 필요한 shadcn/ui 컴포넌트 설치**

```bash
npx shadcn@latest add button card input label select textarea badge dialog table tabs dropdown-menu calendar popover separator sheet toast
```

- [ ] **Step 5: 환경변수 파일 생성**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NOTION_API_KEY=your-notion-key
NOTION_DATABASE_ID=your-notion-db-id
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=your-slack-bot-token
SLACK_TRIGGER_EMOJI=eyes
NEXT_PUBLIC_SLACK_TRIGGER_EMOJI=eyes
```

- [ ] **Step 6: 개발 서버 실행 확인**

```bash
npm run dev
```
Expected: `http://localhost:3000`에 Next.js 기본 페이지 표시

- [ ] **Step 7: 커밋**

```bash
git init
git add .
git commit -m "chore: init Next.js project with dependencies"
```

---

### Task 2: Supabase 스키마 및 인덱스 생성

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: SQL 마이그레이션 파일 작성**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Task table
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  priority text not null default '보통' check (priority in ('긴급', '높음', '보통', '낮음')),
  status text not null default '대기',
  source text not null default 'manual' check (source in ('manual', 'notion', 'slack')),
  requester text,
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  deadline timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  actual_duration integer,
  is_duration_manual boolean not null default false,
  notion_task_id text unique,
  slack_url text,
  slack_channel text,
  slack_sender text,
  delegate_to text,
  follow_up_note text,
  is_deleted boolean not null default false
);

-- CustomStatus table
create table custom_statuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text not null default '#6B7280',
  created_at timestamptz not null default now()
);

-- TimeLog table
create table time_logs (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Slack event dedup table
create table slack_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

-- Notion status mapping table
create table notion_status_mappings (
  id uuid primary key default uuid_generate_v4(),
  notion_status text not null unique,
  wid_status text not null
);

-- Indexes
create index idx_task_status_deleted on tasks(status, is_deleted);
create index idx_task_created_at on tasks(created_at);
create index idx_task_completed_at on tasks(completed_at);
create index idx_timelog_task_started on time_logs(task_id, started_at);
```

- [ ] **Step 2: Supabase 대시보드에서 SQL 실행**

Supabase 프로젝트 SQL Editor에서 위 SQL을 실행.
Expected: 5개 테이블 + 4개 인덱스 생성 완료

- [ ] **Step 3: 커밋**

```bash
git add supabase/
git commit -m "feat: add initial database schema and indexes"
```

---

### Task 3: TypeScript 타입, 상수, Supabase 클라이언트

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/utils.ts`

- [ ] **Step 1: TypeScript 타입 정의 작성**

```typescript
// src/lib/types.ts
export type Priority = '긴급' | '높음' | '보통' | '낮음';
export type Source = 'manual' | 'notion' | 'slack';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: string;
  source: Source;
  requester: string | null;
  requested_at: string | null;
  created_at: string;
  deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  actual_duration: number | null;
  is_duration_manual: boolean;
  notion_task_id: string | null;
  slack_url: string | null;
  slack_channel: string | null;
  slack_sender: string | null;
  delegate_to: string | null;
  follow_up_note: string | null;
  is_deleted: boolean;
}

export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface NotionStatusMapping {
  id: string;
  notion_status: string;
  wid_status: string;
}

export interface DailyStats {
  date: string;
  completed_count: number;
  total_duration: number;
  in_progress_count: number;
  tasks: Task[];
  timelogs: TimeLog[];
}

export interface WeeklyStats {
  week_start: string;
  daily_counts: { date: string; completed: number; created: number }[];
  total_completed: number;
  total_delegated: number;
  total_cancelled: number;
  priority_distribution: { priority: Priority; count: number }[];
  source_distribution: { source: Source; count: number }[];
  daily_durations: { date: string; duration: number }[];
}

export interface MonthlyStats {
  month: string;
  daily_counts: { date: string; completed: number }[];
  weekly_comparison: { week: string; completed: number }[];
  total_completed: number;
  total_delegated: number;
  total_cancelled: number;
  priority_distribution: { priority: Priority; count: number }[];
  source_distribution: { source: Source; count: number }[];
  status_distribution: { status: string; count: number }[];
  avg_processing_time: number;
}
```

- [ ] **Step 2: 상수 정의**

```typescript
// src/lib/constants.ts
export const DEFAULT_STATUSES = [
  '대기', '진행중', '완료', '위임', '취소', '보류', '부분완료',
] as const;

export const PRIORITIES = ['긴급', '높음', '보통', '낮음'] as const;

export const SOURCES = ['manual', 'notion', 'slack'] as const;

export const STATUS_COLORS: Record<string, string> = {
  '대기': '#9CA3AF',
  '진행중': '#3B82F6',
  '완료': '#10B981',
  '위임': '#F59E0B',
  '취소': '#EF4444',
  '보류': '#8B5CF6',
  '부분완료': '#06B6D4',
};

export const PRIORITY_COLORS: Record<string, string> = {
  '긴급': '#EF4444',
  '높음': '#F59E0B',
  '보통': '#3B82F6',
  '낮음': '#9CA3AF',
};
```

- [ ] **Step 3: Supabase 클라이언트 (브라우저)**

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 4: Supabase 클라이언트 (서버)**

```typescript
// src/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: 유틸리티 함수**

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt: string = 'yyyy-MM-dd') {
  return format(new Date(date), fmt, { locale: ko });
}

export function getWeekRange(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function minutesToHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
```

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```
Expected: 에러 없이 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add src/lib/
git commit -m "feat: add types, constants, supabase clients, and utils"
```

---

## Phase 2: 레이아웃 및 네비게이션

### Task 4: 사이드바 및 루트 레이아웃

**Files:**
- Create: `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 사이드바 컴포넌트 작성**

```tsx
// src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Settings,
  Trash2,
} from 'lucide-react';

const navItems = [
  { href: '/', label: '오늘', icon: LayoutDashboard },
  { href: '/weekly', label: '주별', icon: CalendarDays },
  { href: '/monthly', label: '월별', icon: CalendarRange },
  { href: '/tasks', label: '일감 목록', icon: ListTodo },
  { href: '/tasks/trash', label: '휴지통', icon: Trash2 },
  { href: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-gray-50/50 p-4 flex flex-col gap-1">
      <h1 className="text-xl font-bold px-3 py-4">WID</h1>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-gray-200 font-medium'
                : 'hover:bg-gray-100 text-gray-600'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: 헤더 컴포넌트 작성**

```tsx
// src/components/layout/header.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': '오늘의 업무',
  '/weekly': '주별 현황',
  '/monthly': '월별 현황',
  '/tasks': '일감 목록',
  '/tasks/new': '새 일감 등록',
  '/tasks/trash': '휴지통',
  '/settings': '설정',
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? '일감 상세';

  return (
    <header className="h-14 border-b flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button asChild size="sm">
        <Link href="/tasks/new">
          <Plus className="h-4 w-4 mr-1" />
          새 일감
        </Link>
      </Button>
    </header>
  );
}
```

- [ ] **Step 3: 루트 레이아웃 수정**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WID - Work Diary',
  description: '개인 업무일지 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: lucide-react 설치**

```bash
npm install lucide-react
```

- [ ] **Step 5: 개발 서버에서 레이아웃 확인**

```bash
npm run dev
```
Expected: 사이드바 + 헤더 + 빈 메인 영역 표시. 네비게이션 클릭 시 URL 변경.

- [ ] **Step 6: 커밋**

```bash
git add src/components/layout/ src/app/layout.tsx
git commit -m "feat: add sidebar navigation and root layout"
```

---

## Phase 3: 일감 CRUD API

### Task 5: 일감 목록 조회 + 생성 API

**Files:**
- Create: `src/app/api/tasks/route.ts`

- [ ] **Step 1: GET /api/tasks — 목록 조회 (필터/정렬/소프트삭제 제외)**

```typescript
// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const source = searchParams.get('source');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') ?? 'desc';
  const showDeleted = searchParams.get('deleted') === 'true';

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', showDeleted);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (source) query = query.eq('source', source);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  query = query.order(sort, { ascending: order === 'asc' });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: POST /api/tasks — 일감 생성**

같은 파일에 추가:

```typescript
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? '보통',
      status: body.status ?? '대기',
      source: body.source ?? 'manual',
      requester: body.requester ?? null,
      requested_at: body.requested_at ?? null,
      deadline: body.deadline ?? null,
      slack_url: body.slack_url ?? null,
      slack_channel: body.slack_channel ?? null,
      slack_sender: body.slack_sender ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 3: API 테스트 (브라우저 또는 curl)**

```bash
# 일감 생성
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트 일감","priority":"보통"}'

# 목록 조회
curl http://localhost:3000/api/tasks
```
Expected: 201 + 생성된 일감 반환, 200 + 일감 배열 반환

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: add task list and create API endpoints"
```

---

### Task 6: 일감 상세/수정/삭제/복구 API

**Files:**
- Create: `src/app/api/tasks/[id]/route.ts`, `src/app/api/tasks/[id]/restore/route.ts`

- [ ] **Step 1: GET/PATCH/DELETE /api/tasks/[id]**

```typescript
// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  // 상태가 '완료'로 변경되면 completed_at 자동 설정
  if (body.status === '완료' && !body.completed_at) {
    body.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_deleted: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: POST /api/tasks/[id]/restore — 복구**

```typescript
// src/app/api/tasks/[id]/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ is_deleted: false })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: API 테스트**

```bash
# 상세 조회
curl http://localhost:3000/api/tasks/{task-id}

# 수정
curl -X PATCH http://localhost:3000/api/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{"status":"진행중"}'

# 삭제
curl -X DELETE http://localhost:3000/api/tasks/{task-id}

# 복구
curl -X POST http://localhost:3000/api/tasks/{task-id}/restore
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/tasks/
git commit -m "feat: add task detail, update, soft-delete, and restore APIs"
```

---

### Task 7: 타이머 API

**Files:**
- Create: `src/app/api/tasks/[id]/timer/start/route.ts`, `src/app/api/tasks/[id]/timer/stop/route.ts`, `src/app/api/tasks/[id]/timelogs/route.ts`

- [ ] **Step 1: POST /api/tasks/[id]/timer/start — 타이머 시작 (동시 타이머 자동 종료)**

```typescript
// src/app/api/tasks/[id]/timer/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  // 동시 타이머 정책: 실행 중인 다른 타이머 모두 종료
  await supabase
    .from('time_logs')
    .update({ ended_at: now })
    .is('ended_at', null);

  // 새 타이머 시작
  const { data, error } = await supabase
    .from('time_logs')
    .insert({ task_id: id, started_at: now })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Task의 started_at 업데이트 (최초 시작 시)
  await supabase
    .from('tasks')
    .update({ started_at: now, status: '진행중' })
    .eq('id', id)
    .is('started_at', null);

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: POST /api/tasks/[id]/timer/stop — 타이머 종료**

```typescript
// src/app/api/tasks/[id]/timer/stop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('time_logs')
    .update({ ended_at: now })
    .eq('task_id', id)
    .is('ended_at', null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // actual_duration 자동 합산 (is_duration_manual이 false인 경우만)
  const task = await supabase.from('tasks').select('is_duration_manual').eq('id', id).single();
  if (!task.data?.is_duration_manual) {
    const { data: logs } = await supabase
      .from('time_logs')
      .select('started_at, ended_at')
      .eq('task_id', id)
      .not('ended_at', 'is', null);

    const totalMinutes = (logs ?? []).reduce((sum, log) => {
      const start = new Date(log.started_at).getTime();
      const end = new Date(log.ended_at!).getTime();
      return sum + Math.round((end - start) / 60000);
    }, 0);

    await supabase.from('tasks').update({ actual_duration: totalMinutes }).eq('id', id);
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 3: GET /api/timelogs/[taskId] — 타이머 이력**

```typescript
// src/app/api/tasks/[id]/timelogs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('task_id', id)
    .order('started_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/tasks/[id]/timer/ src/app/api/tasks/[id]/timelogs/
git commit -m "feat: add timer start/stop and timelog APIs with concurrent timer policy"
```

---

### Task 8: 커스텀 상태 CRUD API

**Files:**
- Create: `src/app/api/custom-statuses/route.ts`, `src/app/api/custom-statuses/[id]/route.ts`

- [ ] **Step 1: GET/POST /api/custom-statuses**

```typescript
// src/app/api/custom-statuses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('custom_statuses')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('custom_statuses')
    .insert({ name: body.name, color: body.color ?? '#6B7280' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: PATCH/DELETE /api/custom-statuses/[id]**

```typescript
// src/app/api/custom-statuses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('custom_statuses')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('custom_statuses')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/custom-statuses/
git commit -m "feat: add custom status CRUD API"
```

---

### Task 9: 통계 API (일별/주별/월별)

**Files:**
- Create: `src/app/api/stats/daily/route.ts`, `src/app/api/stats/weekly/route.ts`, `src/app/api/stats/monthly/route.ts`

- [ ] **Step 1: GET /api/stats/daily — 일별 통계**

```typescript
// src/app/api/stats/daily/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const dateParam = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateParam);
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const [tasksResult, timelogsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('is_deleted', false)
      .or(`created_at.gte.${dayStart},completed_at.gte.${dayStart},status.eq.진행중`)
      .or(`created_at.lte.${dayEnd},completed_at.lte.${dayEnd},status.eq.진행중`),
    supabase
      .from('time_logs')
      .select('*, tasks!inner(is_deleted)')
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd),
  ]);

  const tasks = tasksResult.data ?? [];
  const timelogs = timelogsResult.data ?? [];

  const completed_count = tasks.filter(
    (t) => t.status === '완료' && t.completed_at && t.completed_at >= dayStart && t.completed_at <= dayEnd
  ).length;

  const in_progress_count = tasks.filter((t) => t.status === '진행중').length;

  const total_duration = timelogs.reduce((sum, log) => {
    if (!log.ended_at) return sum;
    return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
  }, 0);

  return NextResponse.json({
    date: dateParam,
    completed_count,
    total_duration,
    in_progress_count,
    tasks,
    timelogs,
  });
}
```

- [ ] **Step 2: GET /api/stats/weekly — 주별 통계**

```typescript
// src/app/api/stats/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const weekStartParam = request.nextUrl.searchParams.get('week_start');
  const baseDate = weekStartParam ? new Date(weekStartParam) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });

  // created_at 또는 completed_at이 해당 주에 속하는 일감 조회
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', false)
    .or(`created_at.gte.${weekStart.toISOString()}.created_at.lte.${weekEnd.toISOString()},completed_at.gte.${weekStart.toISOString()}.completed_at.lte.${weekEnd.toISOString()}`);

  const { data: timelogs } = await supabase
    .from('time_logs')
    .select('*')
    .gte('started_at', weekStart.toISOString())
    .lte('started_at', weekEnd.toISOString());

  const allTasks = tasks ?? [];
  const allLogs = timelogs ?? [];
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const daily_counts = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return {
      date: dayStr,
      completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
      created: allTasks.filter((t) => t.created_at.startsWith(dayStr)).length,
    };
  });

  const daily_durations = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLogs = allLogs.filter((l) => l.started_at.startsWith(dayStr));
    const duration = dayLogs.reduce((sum, log) => {
      if (!log.ended_at) return sum;
      return sum + Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
    }, 0);
    return { date: dayStr, duration };
  });

  const priorityCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  allTasks.forEach((t) => {
    priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
    sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
  });

  return NextResponse.json({
    week_start: format(weekStart, 'yyyy-MM-dd'),
    daily_counts,
    total_completed: allTasks.filter((t) => t.status === '완료').length,
    total_delegated: allTasks.filter((t) => t.status === '위임').length,
    total_cancelled: allTasks.filter((t) => t.status === '취소').length,
    priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
    source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
    daily_durations,
  });
}
```

- [ ] **Step 3: GET /api/stats/monthly — 월별 통계**

```typescript
// src/app/api/stats/monthly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, format } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const monthParam = request.nextUrl.searchParams.get('month');
  const baseDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);

  // created_at 또는 completed_at이 해당 월에 속하는 일감 조회
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', false)
    .or(`created_at.gte.${monthStart.toISOString()}.created_at.lte.${monthEnd.toISOString()},completed_at.gte.${monthStart.toISOString()}.completed_at.lte.${monthEnd.toISOString()}`);

  const allTasks = tasks ?? [];
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

  const daily_counts = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return {
      date: dayStr,
      completed: allTasks.filter((t) => t.completed_at?.startsWith(dayStr)).length,
    };
  });

  const weekly_comparison = weeks.map((weekStart, i) => ({
    week: `${i + 1}주차`,
    completed: allTasks.filter((t) => {
      if (!t.completed_at) return false;
      const d = new Date(t.completed_at);
      const nextWeek = weeks[i + 1] ?? monthEnd;
      return d >= weekStart && d < nextWeek;
    }).length,
  }));

  const priorityCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  allTasks.forEach((t) => {
    priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
    sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  });

  const completedTasks = allTasks.filter((t) => t.completed_at && t.created_at);
  const avgProcessingTime = completedTasks.length > 0
    ? Math.round(
        completedTasks.reduce((sum, t) => {
          return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 60000;
        }, 0) / completedTasks.length
      )
    : 0;

  return NextResponse.json({
    month: format(monthStart, 'yyyy-MM'),
    daily_counts,
    weekly_comparison,
    total_completed: allTasks.filter((t) => t.status === '완료').length,
    total_delegated: allTasks.filter((t) => t.status === '위임').length,
    total_cancelled: allTasks.filter((t) => t.status === '취소').length,
    priority_distribution: Array.from(priorityCounts, ([priority, count]) => ({ priority, count })),
    source_distribution: Array.from(sourceCounts, ([source, count]) => ({ source, count })),
    status_distribution: Array.from(statusCounts, ([status, count]) => ({ status, count })),
    avg_processing_time: avgProcessingTime,
  });
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/stats/
git commit -m "feat: add daily, weekly, and monthly stats API endpoints"
```

---

## Phase 4: 일감 UI

### Task 10: Zustand 타이머 스토어

**Files:**
- Create: `src/store/timer-store.ts`

- [ ] **Step 1: 타이머 스토어 작성**

```typescript
// src/store/timer-store.ts
import { create } from 'zustand';

interface TimerState {
  activeTaskId: string | null;
  activeTimeLogId: string | null;
  startedAt: string | null;
  elapsed: number; // seconds
  intervalId: NodeJS.Timeout | null;

  startTimer: (taskId: string, timeLogId: string, startedAt: string) => void;
  stopTimer: () => void;
  tick: () => void;
  setFromServer: (taskId: string | null, timeLogId: string | null, startedAt: string | null) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTaskId: null,
  activeTimeLogId: null,
  startedAt: null,
  elapsed: 0,
  intervalId: null,

  startTimer: (taskId, timeLogId, startedAt) => {
    const prev = get().intervalId;
    if (prev) clearInterval(prev);

    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const intervalId = setInterval(() => get().tick(), 1000);

    set({ activeTaskId: taskId, activeTimeLogId: timeLogId, startedAt, elapsed, intervalId });
  },

  stopTimer: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ activeTaskId: null, activeTimeLogId: null, startedAt: null, elapsed: 0, intervalId: null });
  },

  tick: () => set((state) => ({ elapsed: state.elapsed + 1 })),

  setFromServer: (taskId, timeLogId, startedAt) => {
    if (taskId && startedAt) {
      get().startTimer(taskId, timeLogId!, startedAt);
    } else {
      get().stopTimer();
    }
  },
}));
```

- [ ] **Step 2: 커밋**

```bash
git add src/store/
git commit -m "feat: add Zustand timer store with concurrent timer support"
```

---

### Task 11: 일감 카드 + 타이머 버튼 컴포넌트

**Files:**
- Create: `src/components/tasks/task-card.tsx`, `src/components/tasks/timer-button.tsx`

- [ ] **Step 1: 타이머 버튼 컴포넌트**

```tsx
// src/components/tasks/timer-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { useTimerStore } from '@/store/timer-store';

interface TimerButtonProps {
  taskId: string;
  onTimerChange?: () => void;
}

export function TimerButton({ taskId, onTimerChange }: TimerButtonProps) {
  const { activeTaskId, elapsed, startTimer, stopTimer } = useTimerStore();
  const isRunning = activeTaskId === taskId;

  const handleStart = async () => {
    const res = await fetch(`/api/tasks/${taskId}/timer/start`, { method: 'POST' });
    const data = await res.json();
    startTimer(taskId, data.id, data.started_at);
    onTimerChange?.();
  };

  const handleStop = async () => {
    await fetch(`/api/tasks/${taskId}/timer/stop`, { method: 'POST' });
    stopTimer();
    onTimerChange?.();
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isRunning) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-blue-600">{formatElapsed(elapsed)}</span>
        <Button variant="destructive" size="sm" onClick={handleStop}>
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleStart}>
      <Play className="h-3 w-3" />
    </Button>
  );
}
```

- [ ] **Step 2: 일감 카드 컴포넌트**

```tsx
// src/components/tasks/task-card.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimerButton } from './timer-button';
import { PRIORITY_COLORS, STATUS_COLORS } from '@/lib/constants';
import { Task } from '@/lib/types';
import { formatDate, minutesToHoursMinutes } from '@/lib/utils';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
  onTimerChange?: () => void;
}

export function TaskCard({ task, onTimerChange }: TaskCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link href={`/tasks/${task.id}`} className="font-medium hover:underline truncate block">
              {task.title}
            </Link>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="outline"
                style={{ borderColor: PRIORITY_COLORS[task.priority], color: PRIORITY_COLORS[task.priority] }}
              >
                {task.priority}
              </Badge>
              <Badge
                style={{ backgroundColor: STATUS_COLORS[task.status] ?? '#6B7280', color: 'white' }}
              >
                {task.status}
              </Badge>
              {task.source !== 'manual' && (
                <Badge variant="secondary">{task.source}</Badge>
              )}
              {task.deadline && (
                <span className="text-xs text-gray-500">마감: {formatDate(task.deadline)}</span>
              )}
              {task.actual_duration != null && (
                <span className="text-xs text-gray-500">{minutesToHoursMinutes(task.actual_duration)}</span>
              )}
            </div>
            {task.requester && (
              <p className="text-xs text-gray-400 mt-1">요청: {task.requester}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <TimerButton taskId={task.id} onTimerChange={onTimerChange} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/tasks/task-card.tsx src/components/tasks/timer-button.tsx
git commit -m "feat: add task card and timer button components"
```

---

### Task 12: 일감 필터 + 목록 컴포넌트 + 페이지

**Files:**
- Create: `src/components/tasks/task-filters.tsx`, `src/components/tasks/task-list.tsx`
- Modify: `src/app/tasks/page.tsx`

- [ ] **Step 1: 필터 컴포넌트**

```tsx
// src/components/tasks/task-filters.tsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_STATUSES, PRIORITIES, SOURCES } from '@/lib/constants';

interface TaskFiltersProps {
  status: string;
  priority: string;
  source: string;
  onStatusChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onSourceChange: (v: string) => void;
}

export function TaskFilters({
  status, priority, source,
  onStatusChange, onPriorityChange, onSourceChange,
}: TaskFiltersProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-32"><SelectValue placeholder="상태" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          {DEFAULT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-32"><SelectValue placeholder="우선순위" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 우선순위</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={source} onValueChange={onSourceChange}>
        <SelectTrigger className="w-32"><SelectValue placeholder="출처" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: 일감 목록 페이지**

```tsx
// src/app/tasks/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Task } from '@/lib/types';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskFilters } from '@/components/tasks/task-filters';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [source, setSource] = useState('all');

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (source !== 'all') params.set('source', source);

    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    setTasks(data);
  }, [status, priority, source]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  return (
    <div className="space-y-4">
      <TaskFilters
        status={status} priority={priority} source={source}
        onStatusChange={setStatus} onPriorityChange={setPriority} onSourceChange={setSource}
      />
      <div className="space-y-3">
        {tasks.length === 0 && <p className="text-gray-500 text-sm">일감이 없습니다.</p>}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onTimerChange={fetchTasks} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저에서 /tasks 페이지 확인**

Expected: 필터 드롭다운 3개 + 일감 카드 리스트 (데이터가 있으면 표시)

- [ ] **Step 4: 커밋**

```bash
git add src/components/tasks/task-filters.tsx src/app/tasks/page.tsx
git commit -m "feat: add task list page with filters"
```

---

### Task 13: 일감 등록 폼 + 페이지

**Files:**
- Create: `src/components/tasks/task-form.tsx`, `src/app/tasks/new/page.tsx`

- [ ] **Step 1: 일감 폼 컴포넌트 (생성/수정 겸용)**

```tsx
// src/components/tasks/task-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES, DEFAULT_STATUSES } from '@/lib/constants';
import { Task } from '@/lib/types';

interface TaskFormProps {
  task?: Task;
  customStatuses?: string[];
}

export function TaskForm({ task, customStatuses = [] }: TaskFormProps) {
  const router = useRouter();
  const isEdit = !!task;
  const allStatuses = [...DEFAULT_STATUSES, ...customStatuses];

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? '보통',
    status: task?.status ?? '대기',
    requester: task?.requester ?? '',
    requested_at: task?.requested_at?.slice(0, 10) ?? '',
    deadline: task?.deadline?.slice(0, 10) ?? '',
    delegate_to: task?.delegate_to ?? '',
    follow_up_note: task?.follow_up_note ?? '',
    actual_duration: task?.actual_duration?.toString() ?? '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status: form.status,
      requester: form.requester || null,
      requested_at: form.requested_at || null,
      deadline: form.deadline || null,
    };

    if (isEdit) {
      payload.delegate_to = form.delegate_to || null;
      payload.follow_up_note = form.follow_up_note || null;
      if (form.actual_duration) {
        payload.actual_duration = parseInt(form.actual_duration);
        payload.is_duration_manual = true;
      }
    }

    const url = isEdit ? `/api/tasks/${task.id}` : '/api/tasks';
    const method = isEdit ? 'PATCH' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    router.push(isEdit ? `/tasks/${task.id}` : '/tasks');
    router.refresh();
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <Label htmlFor="title">제목 *</Label>
        <Input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="description">설명</Label>
        <Textarea id="description" value={form.description} onChange={(e) => update('description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>우선순위</Label>
          <Select value={form.priority} onValueChange={(v) => update('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>상태</Label>
          <Select value={form.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="requester">요청자</Label>
          <Input id="requester" value={form.requester} onChange={(e) => update('requester', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="requested_at">요청일</Label>
          <Input id="requested_at" type="date" value={form.requested_at} onChange={(e) => update('requested_at', e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="deadline">마감일</Label>
        <Input id="deadline" type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
      </div>
      {isEdit && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delegate_to">위임 대상</Label>
              <Input id="delegate_to" value={form.delegate_to} onChange={(e) => update('delegate_to', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="actual_duration">소요시간 (분)</Label>
              <Input id="actual_duration" type="number" value={form.actual_duration} onChange={(e) => update('actual_duration', e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="follow_up_note">후속 작업 메모</Label>
            <Textarea id="follow_up_note" value={form.follow_up_note} onChange={(e) => update('follow_up_note', e.target.value)} />
          </div>
        </>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: 새 일감 등록 페이지**

```tsx
// src/app/tasks/new/page.tsx
import { TaskForm } from '@/components/tasks/task-form';

export default function NewTaskPage() {
  return (
    <div>
      <TaskForm />
    </div>
  );
}
```

- [ ] **Step 3: 브라우저에서 /tasks/new 확인**

Expected: 폼 입력 후 등록 → /tasks로 이동, 새 일감 표시

- [ ] **Step 4: 커밋**

```bash
git add src/components/tasks/task-form.tsx src/app/tasks/new/
git commit -m "feat: add task create/edit form and new task page"
```

---

### Task 14: 일감 상세/수정 페이지

**Files:**
- Create: `src/app/tasks/[id]/page.tsx`

- [ ] **Step 1: 일감 상세 페이지 (조회 + 수정 폼 + 타이머 이력)**

```tsx
// src/app/tasks/[id]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { Task, TimeLog } from '@/lib/types';
import { TaskForm } from '@/components/tasks/task-form';
import { TimerButton } from '@/components/tasks/timer-button';
import { formatDate, minutesToHoursMinutes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [timelogs, setTimelogs] = useState<TimeLog[]>([]);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);

  const fetchData = async () => {
    const [taskRes, logsRes, statusRes] = await Promise.all([
      fetch(`/api/tasks/${id}`),
      fetch(`/api/tasks/${id}/timelogs`),
      fetch('/api/custom-statuses'),
    ]);
    setTask(await taskRes.json());
    setTimelogs(await logsRes.json());
    const statuses = await statusRes.json();
    setCustomStatuses(statuses.map((s: { name: string }) => s.name));
  };

  useEffect(() => { fetchData(); }, [id]);

  if (!task) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <TimerButton taskId={task.id} onTimerChange={fetchData} />
        {task.slack_url && (
          <a href={task.slack_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
            Slack 메시지 보기
          </a>
        )}
      </div>

      <TaskForm task={task} customStatuses={customStatuses} />

      {timelogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">타이머 기록</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timelogs.map((log) => (
                <div key={log.id} className="flex justify-between text-sm">
                  <span>{formatDate(log.started_at, 'MM/dd HH:mm')}</span>
                  <span>
                    {log.ended_at
                      ? minutesToHoursMinutes(Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000))
                      : '진행중'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 /tasks/{id} 확인**

Expected: 일감 상세 정보 + 수정 폼 + 타이머 이력 표시

- [ ] **Step 3: 커밋**

```bash
git add src/app/tasks/[id]/
git commit -m "feat: add task detail page with edit form and timer history"
```

---

### Task 15: 휴지통 페이지

**Files:**
- Create: `src/app/tasks/trash/page.tsx`

- [ ] **Step 1: 휴지통 페이지**

```tsx
// src/app/tasks/trash/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw } from 'lucide-react';

export default function TrashPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = async () => {
    const res = await fetch('/api/tasks?deleted=true');
    setTasks(await res.json());
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleRestore = async (id: string) => {
    await fetch(`/api/tasks/${id}/restore`, { method: 'POST' });
    fetchTasks();
  };

  return (
    <div className="space-y-3">
      {tasks.length === 0 && <p className="text-gray-500 text-sm">휴지통이 비어있습니다.</p>}
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{task.title}</p>
              <Badge variant="secondary" className="mt-1">{task.status}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleRestore(task.id)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              복구
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/tasks/trash/
git commit -m "feat: add trash page with restore functionality"
```

---

## Phase 5: 대시보드

### Task 16: 대시보드 공통 컴포넌트 (요약 카드, 날짜 네비게이터)

**Files:**
- Create: `src/components/dashboard/summary-cards.tsx`, `src/components/dashboard/date-navigator.tsx`

- [ ] **Step 1: 요약 카드 컴포넌트**

```tsx
// src/components/dashboard/summary-cards.tsx
import { Card, CardContent } from '@/components/ui/card';
import { minutesToHoursMinutes } from '@/lib/utils';

interface SummaryCardsProps {
  completedCount: number;
  totalDuration: number;
  inProgressCount: number;
}

export function SummaryCards({ completedCount, totalDuration, inProgressCount }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          <p className="text-sm text-gray-500">완료</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{minutesToHoursMinutes(totalDuration)}</p>
          <p className="text-sm text-gray-500">총 소요시간</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{inProgressCount}</p>
          <p className="text-sm text-gray-500">진행중</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 날짜 네비게이터 컴포넌트**

```tsx
// src/components/dashboard/date-navigator.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';

interface DateNavigatorProps {
  label: string;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onDateSelect: (date: Date) => void;
}

export function DateNavigator({ label, currentDate, onPrev, onNext, onDateSelect }: DateNavigatorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="text-lg font-semibold min-w-[180px]">
            {label}
            <CalendarIcon className="h-4 w-4 ml-2 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => { if (date) { onDateSelect(date); setOpen(false); } }}
          />
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/dashboard/summary-cards.tsx src/components/dashboard/date-navigator.tsx
git commit -m "feat: add summary cards and date navigator components"
```

---

### Task 17: 차트 컴포넌트들

**Files:**
- Create: `src/components/dashboard/timeline-chart.tsx`, `src/components/dashboard/heatmap-calendar.tsx`, `src/components/dashboard/priority-pie-chart.tsx`, `src/components/dashboard/source-pie-chart.tsx`, `src/components/dashboard/duration-bar-chart.tsx`, `src/components/dashboard/trend-line-chart.tsx`

- [ ] **Step 1: 타임라인 차트 (일별 — 시간대별 가로 막대)**

```tsx
// src/components/dashboard/timeline-chart.tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TimeLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimelineChartProps {
  timelogs: TimeLog[];
}

export function TimelineChart({ timelogs }: TimelineChartProps) {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}시`,
    minutes: 0,
  }));

  timelogs.forEach((log) => {
    if (!log.ended_at) return;
    const start = new Date(log.started_at);
    const end = new Date(log.ended_at);
    const startHour = start.getHours();
    const endHour = end.getHours();
    for (let h = startHour; h <= endHour && h < 24; h++) {
      const segStart = h === startHour ? start.getMinutes() : 0;
      const segEnd = h === endHour ? end.getMinutes() : 60;
      hours[h].minutes += segEnd - segStart;
    }
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">시간대별 작업량</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hours.filter((h) => h.minutes > 0)}>
            <XAxis dataKey="hour" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v: number) => `${v}분`} />
            <Bar dataKey="minutes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 히트맵 캘린더**

```tsx
// src/components/dashboard/heatmap-calendar.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HeatmapCalendarProps {
  data: { date: string; completed: number }[];
  title?: string;
}

export function HeatmapCalendar({ data, title = '완료 히트맵' }: HeatmapCalendarProps) {
  const maxCount = Math.max(...data.map((d) => d.completed), 1);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 'bg-green-200';
    if (ratio <= 0.5) return 'bg-green-300';
    if (ratio <= 0.75) return 'bg-green-400';
    return 'bg-green-600';
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {data.map((d) => (
            <div
              key={d.date}
              className={cn('w-8 h-8 rounded text-xs flex items-center justify-center', getIntensity(d.completed))}
              title={`${d.date}: ${d.completed}건`}
            >
              {new Date(d.date).getDate()}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 파이 차트 (우선순위 + 출처)**

```tsx
// src/components/dashboard/priority-pie-chart.tsx
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PRIORITY_COLORS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PriorityPieChartProps {
  data: { priority: string; count: number }[];
}

export function PriorityPieChart({ data }: PriorityPieChartProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">우선순위 분포</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={70} label>
              {data.map((entry) => (
                <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] ?? '#6B7280'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/dashboard/source-pie-chart.tsx
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SOURCE_COLORS: Record<string, string> = {
  manual: '#3B82F6',
  notion: '#000000',
  slack: '#E01E5A',
};

interface SourcePieChartProps {
  data: { source: string; count: number }[];
}

export function SourcePieChart({ data }: SourcePieChartProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">출처별 분포</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label>
              {data.map((entry) => (
                <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] ?? '#6B7280'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 바 차트 (소요시간) + 라인 차트 (월별 추이)**

```tsx
// src/components/dashboard/duration-bar-chart.tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DurationBarChartProps {
  data: { date: string; duration: number }[];
}

export function DurationBarChart({ data }: DurationBarChartProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">일평균 소요시간 (분)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="date" fontSize={12} tickFormatter={(v) => v.slice(5)} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v: number) => `${v}분`} />
            <Bar dataKey="duration" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/dashboard/trend-line-chart.tsx
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendLineChartProps {
  data: { week: string; completed: number; delegated: number; cancelled: number }[];
}

export function TrendLineChart({ data }: TrendLineChartProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">주차별 완료 추이</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="week" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="완료" />
            <Line type="monotone" dataKey="delegated" stroke="#F59E0B" strokeWidth={2} name="위임" />
            <Line type="monotone" dataKey="cancelled" stroke="#EF4444" strokeWidth={2} name="취소" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/dashboard/
git commit -m "feat: add dashboard chart components (timeline, heatmap, pie, bar, line)"
```

---

### Task 18: 일별 대시보드 페이지 (메인)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 일별 대시보드 페이지**

```tsx
// src/app/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DailyStats } from '@/lib/types';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { DateNavigator } from '@/components/dashboard/date-navigator';
import { TimelineChart } from '@/components/dashboard/timeline-chart';
import { TaskCard } from '@/components/tasks/task-card';

export default function DailyPage() {
  const [date, setDate] = useState(new Date());
  const [stats, setStats] = useState<DailyStats | null>(null);

  const dateStr = format(date, 'yyyy-MM-dd');
  const label = format(date, 'yyyy년 M월 d일 (EEEE)', { locale: ko });

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/stats/daily?date=${dateStr}`);
    setStats(await res.json());
  }, [dateStr]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (!stats) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6">
      <DateNavigator
        label={label}
        currentDate={date}
        onPrev={() => setDate((d) => addDays(d, -1))}
        onNext={() => setDate((d) => addDays(d, 1))}
        onDateSelect={(d) => setDate(d)}
      />
      <SummaryCards
        completedCount={stats.completed_count}
        totalDuration={stats.total_duration}
        inProgressCount={stats.in_progress_count}
      />
      <TimelineChart timelogs={stats.timelogs} />
      <div>
        <h3 className="font-semibold mb-3">오늘의 일감</h3>
        <div className="space-y-3">
          {stats.tasks.length === 0 && <p className="text-gray-500 text-sm">일감이 없습니다.</p>}
          {stats.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onTimerChange={fetchStats} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 / 확인**

Expected: 날짜 네비게이터 + 요약 카드 3개 + 타임라인 차트 + 오늘의 일감 리스트

- [ ] **Step 3: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: add daily dashboard page as main view"
```

---

### Task 19: 주별 대시보드 페이지

**Files:**
- Create: `src/app/weekly/page.tsx`

- [ ] **Step 1: 주별 뷰 페이지**

```tsx
// src/app/weekly/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { addWeeks, startOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { WeeklyStats } from '@/lib/types';
import { DateNavigator } from '@/components/dashboard/date-navigator';
import { HeatmapCalendar } from '@/components/dashboard/heatmap-calendar';
import { PriorityPieChart } from '@/components/dashboard/priority-pie-chart';
import { SourcePieChart } from '@/components/dashboard/source-pie-chart';
import { DurationBarChart } from '@/components/dashboard/duration-bar-chart';
import { Card, CardContent } from '@/components/ui/card';

export default function WeeklyPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const label = `${format(weekStart, 'M월 d일', { locale: ko })} ~ ${format(addWeeks(weekStart, 1), 'M월 d일', { locale: ko })}`;

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/stats/weekly?week_start=${weekStartStr}`);
    setStats(await res.json());
  }, [weekStartStr]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (!stats) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6">
      <DateNavigator
        label={label}
        currentDate={baseDate}
        onPrev={() => setBaseDate((d) => addWeeks(d, -1))}
        onNext={() => setBaseDate((d) => addWeeks(d, 1))}
        onDateSelect={(d) => setBaseDate(d)}
      />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.total_completed}</p>
            <p className="text-sm text-gray-500">완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.total_delegated}</p>
            <p className="text-sm text-gray-500">위임</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.total_cancelled}</p>
            <p className="text-sm text-gray-500">취소</p>
          </CardContent>
        </Card>
      </div>
      <HeatmapCalendar data={stats.daily_counts} />
      <div>
        <h3 className="font-semibold mb-3">일감 흐름</h3>
        {stats.daily_counts.map((day) => {
          const dayTasks = stats.tasks_by_day?.[day.date] ?? [];
          if (dayTasks.length === 0) return null;
          return (
            <div key={day.date} className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-1">{day.date}</p>
              <div className="space-y-1 pl-3 border-l-2 border-gray-200">
                {dayTasks.map((t: any) => (
                  <p key={t.id} className="text-sm">{t.title} <span className="text-gray-400">({t.status})</span></p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PriorityPieChart data={stats.priority_distribution} />
        <SourcePieChart data={stats.source_distribution} />
      </div>
      <DurationBarChart data={stats.daily_durations} />
    </div>
  );
}
```

> **Note:** 주별 통계 API 응답에 `tasks_by_day` 필드를 추가해야 함 — 날짜별로 그룹핑된 일감 목록. 주별 API에서 `daily_counts` 생성 시 해당 날짜 일감 목록도 함께 반환:
> ```typescript
> const tasks_by_day: Record<string, Task[]> = {};
> days.forEach((day) => {
>   const dayStr = format(day, 'yyyy-MM-dd');
>   tasks_by_day[dayStr] = allTasks.filter(
>     (t) => t.created_at.startsWith(dayStr) || t.completed_at?.startsWith(dayStr)
>   );
> });
> ```
> 응답 객체에 `tasks_by_day`를 포함할 것.

- [ ] **Step 2: 커밋**

```bash
git add src/app/weekly/
git commit -m "feat: add weekly dashboard page with heatmap, task flow list, and charts"
```

---

### Task 20: 월별 대시보드 페이지

**Files:**
- Create: `src/app/monthly/page.tsx`

- [ ] **Step 1: 월별 뷰 페이지**

```tsx
// src/app/monthly/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { addMonths, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MonthlyStats } from '@/lib/types';
import { DateNavigator } from '@/components/dashboard/date-navigator';
import { HeatmapCalendar } from '@/components/dashboard/heatmap-calendar';
import { PriorityPieChart } from '@/components/dashboard/priority-pie-chart';
import { SourcePieChart } from '@/components/dashboard/source-pie-chart';
import { TrendLineChart } from '@/components/dashboard/trend-line-chart';
import { Card, CardContent } from '@/components/ui/card';
import { minutesToHoursMinutes } from '@/lib/utils';

export default function MonthlyPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [stats, setStats] = useState<MonthlyStats | null>(null);

  const monthStr = format(baseDate, 'yyyy-MM');
  const label = format(baseDate, 'yyyy년 M월', { locale: ko });

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/stats/monthly?month=${monthStr}`);
    setStats(await res.json());
  }, [monthStr]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (!stats) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6">
      <DateNavigator
        label={label}
        currentDate={baseDate}
        onPrev={() => setBaseDate((d) => addMonths(d, -1))}
        onNext={() => setBaseDate((d) => addMonths(d, 1))}
        onDateSelect={(d) => setBaseDate(d)}
      />
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.total_completed}</p>
            <p className="text-sm text-gray-500">완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.total_delegated}</p>
            <p className="text-sm text-gray-500">위임</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.total_cancelled}</p>
            <p className="text-sm text-gray-500">취소</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{minutesToHoursMinutes(stats.avg_processing_time)}</p>
            <p className="text-sm text-gray-500">평균 처리시간</p>
          </CardContent>
        </Card>
      </div>
      <HeatmapCalendar data={stats.daily_counts} />
      <TrendLineChart data={stats.weekly_comparison} />
      <div className="grid grid-cols-2 gap-4">
        <PriorityPieChart data={stats.priority_distribution} />
        <SourcePieChart data={stats.source_distribution} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">상태별 분포</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.status_distribution} layout="vertical">
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="status" type="category" fontSize={12} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Note:** MonthlyPage에 추가 import 필요:
> ```tsx
> import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
> import { CardHeader, CardTitle } from '@/components/ui/card';
> ```

- [ ] **Step 2: 커밋**

```bash
git add src/app/monthly/
git commit -m "feat: add monthly dashboard page with heatmap, trends, status distribution, and charts"
```

---

## Phase 6: 연동 (Notion + Slack)

### Task 21: 노션 동기화 API + 상태 매핑

**Files:**
- Create: `src/app/api/notion/sync/route.ts`, `src/app/api/settings/notion-mapping/route.ts`

- [ ] **Step 1: 노션 동기화 API**

```typescript
// src/app/api/notion/sync/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Client } from '@notionhq/client';

export async function POST() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const supabase = createServerSupabaseClient();

  // 상태 매핑 조회
  const { data: mappings } = await supabase.from('notion_status_mappings').select('*');
  const statusMap = new Map((mappings ?? []).map((m) => [m.notion_status, m.wid_status]));

  // 노션 DB 쿼리
  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
  });

  let created = 0;
  let updated = 0;

  for (const page of response.results) {
    if (!('properties' in page)) continue;
    const props = page.properties;

    const title = (props['이름'] ?? props['Name'] ?? props['제목'])?.type === 'title'
      ? ((props['이름'] ?? props['Name'] ?? props['제목']) as any).title?.[0]?.plain_text ?? ''
      : '';

    const notionStatus = (props['상태'] ?? props['Status'])?.type === 'status'
      ? ((props['상태'] ?? props['Status']) as any).status?.name ?? ''
      : '';

    const deadline = (props['마감일'] ?? props['Due'] ?? props['Deadline'])?.type === 'date'
      ? ((props['마감일'] ?? props['Due'] ?? props['Deadline']) as any).date?.start ?? null
      : null;

    const assignee = (props['담당자'] ?? props['Assignee'])?.type === 'people'
      ? ((props['담당자'] ?? props['Assignee']) as any).people?.[0]?.name ?? null
      : null;

    const widStatus = statusMap.get(notionStatus) ?? '대기';

    // 기존 일감 확인
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, status, title, deadline')
      .eq('notion_task_id', page.id)
      .single();

    if (existing) {
      // 업데이트 (WID에서 상태를 수동 변경하지 않은 경우만)
      const updates: Record<string, unknown> = {};
      if (existing.title !== title) updates.title = title;
      if (existing.deadline !== deadline) updates.deadline = deadline;

      // 상태는 WID에서 수동 변경하지 않은 경우만 업데이트
      const defaultFromNotion = statusMap.get(notionStatus);
      if (defaultFromNotion && existing.status === defaultFromNotion) {
        // 이전에 노션에서 매핑된 상태와 같으면 → 업데이트 가능
      } else if (defaultFromNotion) {
        updates.status = widStatus;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('tasks').update(updates).eq('id', existing.id);
        updated++;
      }
    } else {
      // 새로 생성
      await supabase.from('tasks').insert({
        title: title || '(제목 없음)',
        status: widStatus,
        source: 'notion',
        notion_task_id: page.id,
        deadline,
        requester: assignee,
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, total: response.results.length });
}
```

- [ ] **Step 2: Notion SDK 설치**

```bash
npm install @notionhq/client
```

- [ ] **Step 3: 노션 상태 매핑 API**

```typescript
// src/app/api/settings/notion-mapping/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('notion_status_mappings').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();
  // body: { mappings: [{ notion_status: string, wid_status: string }] }

  // 기존 매핑 삭제 후 재생성
  await supabase.from('notion_status_mappings').delete().gte('created_at', '1970-01-01');

  if (body.mappings?.length > 0) {
    const { error } = await supabase.from('notion_status_mappings').insert(body.mappings);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/notion/ src/app/api/settings/
git commit -m "feat: add Notion sync API with status mapping and conflict handling"
```

---

### Task 22: 슬랙 웹훅 API

**Files:**
- Create: `src/app/api/slack/webhook/route.ts`

- [ ] **Step 1: 슬랙 웹훅 (Signing Secret 검증 + 멱등성)**

```typescript
// src/app/api/slack/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import crypto from 'crypto';

async function verifySlackSignature(request: NextRequest, body: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const slackSignature = request.headers.get('x-slack-signature') ?? '';

  // 5분 이상 오래된 요청 거부
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Signing Secret 검증
  const isValid = await verifySlackSignature(request, body);
  if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });

  const payload = JSON.parse(body);

  // Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== 'event_callback') {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  const eventId = payload.event_id;

  // 멱등성: 이미 처리된 이벤트인지 확인
  const supabase = createServerSupabaseClient();
  const { data: existing } = await supabase
    .from('slack_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single();

  if (existing) return NextResponse.json({ ok: true });

  // 이벤트 ID 기록
  await supabase.from('slack_events').insert({ event_id: eventId });

  // reaction_added 이벤트만 처리
  if (event.type !== 'reaction_added') return NextResponse.json({ ok: true });

  const triggerEmoji = process.env.SLACK_TRIGGER_EMOJI ?? 'eyes';
  if (event.reaction !== triggerEmoji) return NextResponse.json({ ok: true });

  // Slack API로 메시지 상세 조회
  const botToken = process.env.SLACK_BOT_TOKEN!;

  const msgRes = await fetch(
    `https://slack.com/api/conversations.history?channel=${event.item.channel}&latest=${event.item.ts}&limit=1&inclusive=true`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const msgData = await msgRes.json();
  const message = msgData.messages?.[0];

  if (!message) return NextResponse.json({ ok: true });

  // 채널 정보 조회
  const channelRes = await fetch(
    `https://slack.com/api/conversations.info?channel=${event.item.channel}`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const channelData = await channelRes.json();
  const channelName = channelData.channel?.name ?? event.item.channel;

  // 사용자 정보 조회
  const userRes = await fetch(
    `https://slack.com/api/users.info?user=${message.user}`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const userData = await userRes.json();
  const senderName = userData.user?.real_name ?? userData.user?.name ?? message.user;

  // 슬랙 메시지 URL 생성
  const slackUrl = `https://slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;

  // 일감 생성
  await supabase.from('tasks').insert({
    title: message.text?.slice(0, 200) || '(슬랙 메시지)',
    source: 'slack',
    slack_url: slackUrl,
    slack_channel: channelName,
    slack_sender: senderName,
    requester: senderName,
    requested_at: new Date(parseFloat(message.ts) * 1000).toISOString(),
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/slack/
git commit -m "feat: add Slack webhook with signing secret verification and idempotency"
```

---

## Phase 7: 설정 페이지

### Task 23: 설정 페이지 (커스텀 상태 + 노션 매핑 + 슬랙 설정)

**Files:**
- Create: `src/components/settings/custom-status-manager.tsx`, `src/components/settings/notion-mapping.tsx`, `src/components/settings/slack-settings.tsx`, `src/app/settings/page.tsx`

- [ ] **Step 1: 커스텀 상태 관리 컴포넌트**

```tsx
// src/components/settings/custom-status-manager.tsx
'use client';

import { useEffect, useState } from 'react';
import { CustomStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_STATUSES, STATUS_COLORS } from '@/lib/constants';
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';

export function CustomStatusManager() {
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const fetchStatuses = async () => {
    const res = await fetch('/api/custom-statuses');
    setStatuses(await res.json());
  };

  useEffect(() => { fetchStatuses(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch('/api/custom-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    setNewName('');
    setNewColor('#6B7280');
    fetchStatuses();
  };

  const handleEdit = (s: CustomStatus) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/custom-statuses/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    setEditingId(null);
    fetchStatuses();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/custom-statuses/${id}`, { method: 'DELETE' });
    fetchStatuses();
  };

  return (
    <Card>
      <CardHeader><CardTitle>상태 관리</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">기본 상태 (삭제 불가)</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_STATUSES.map((s) => (
              <Badge key={s} style={{ backgroundColor: STATUS_COLORS[s], color: 'white' }}>{s}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-2">커스텀 상태</p>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                {editingId === s.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-32 h-8" />
                    <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-12 h-8" />
                    <Button variant="ghost" size="sm" onClick={handleEditSave}><Check className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  </>
                ) : (
                  <>
                    <Badge style={{ backgroundColor: s.color, color: 'white' }}>{s.name}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input
              placeholder="상태 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-40"
            />
            <Input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-16"
            />
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />추가
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 노션 매핑 컴포넌트**

```tsx
// src/components/settings/notion-mapping.tsx
'use client';

import { useEffect, useState } from 'react';
import { NotionStatusMapping } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, RefreshCw } from 'lucide-react';

export function NotionMapping() {
  const [mappings, setMappings] = useState<NotionStatusMapping[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchMappings = async () => {
    const res = await fetch('/api/settings/notion-mapping');
    setMappings(await res.json());
  };

  useEffect(() => { fetchMappings(); }, []);

  const handleSave = async () => {
    await fetch('/api/settings/notion-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mappings: mappings.map((m) => ({ notion_status: m.notion_status, wid_status: m.wid_status })),
      }),
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch('/api/notion/sync', { method: 'POST' });
    const data = await res.json();
    setSyncResult(`동기화 완료: ${data.created}건 생성, ${data.updated}건 업데이트 (총 ${data.total}건)`);
    setSyncing(false);
  };

  const addMapping = () => {
    setMappings([...mappings, { id: crypto.randomUUID(), notion_status: '', wid_status: '대기' }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, key: 'notion_status' | 'wid_status', value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [key]: value };
    setMappings(updated);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Notion 연동</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">상태 매핑 (Notion 상태 → WID 상태)</p>
          <div className="space-y-2">
            {mappings.map((m, i) => (
              <div key={m.id} className="flex gap-2 items-center">
                <Input
                  placeholder="Notion 상태"
                  value={m.notion_status}
                  onChange={(e) => updateMapping(i, 'notion_status', e.target.value)}
                  className="w-40"
                />
                <span className="text-gray-400">→</span>
                <Input
                  placeholder="WID 상태"
                  value={m.wid_status}
                  onChange={(e) => updateMapping(i, 'wid_status', e.target.value)}
                  className="w-40"
                />
                <Button variant="ghost" size="sm" onClick={() => removeMapping(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-4 w-4 mr-1" />매핑 추가
            </Button>
            <Button size="sm" onClick={handleSave}>저장</Button>
          </div>
        </div>
        <div className="pt-4 border-t">
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : 'Notion 동기화 실행'}
          </Button>
          {syncResult && <p className="text-sm text-green-600 mt-2">{syncResult}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 슬랙 설정 컴포넌트**

```tsx
// src/components/settings/slack-settings.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SlackSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>Slack 연동</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-2">
          <p><strong>트리거 이모지:</strong> <code>:{process.env.NEXT_PUBLIC_SLACK_TRIGGER_EMOJI ?? 'eyes'}:</code></p>
          <p><strong>웹훅 URL:</strong> <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/slack/webhook</code></p>
          <p className="text-gray-500">
            Slack App 설정에서 Event Subscriptions의 Request URL에 위 웹훅 URL을 등록하고,
            Subscribe to bot events에 <code>reaction_added</code>를 추가하세요.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 설정 페이지**

```tsx
// src/app/settings/page.tsx
import { CustomStatusManager } from '@/components/settings/custom-status-manager';
import { NotionMapping } from '@/components/settings/notion-mapping';
import { SlackSettings } from '@/components/settings/slack-settings';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <CustomStatusManager />
      <NotionMapping />
      <SlackSettings />
    </div>
  );
}
```

- [ ] **Step 5: 브라우저에서 /settings 확인**

Expected: 3개 카드 (상태 관리, Notion 연동, Slack 연동) 표시

- [ ] **Step 6: 커밋**

```bash
git add src/components/settings/ src/app/settings/
git commit -m "feat: add settings page with custom status, Notion mapping, and Slack config"
```

---

## Phase 8: 최종 점검

### Task 24: 전체 빌드 + 동작 확인

**Files:** (수정 필요 시만)

- [ ] **Step 1: 빌드 확인**

```bash
npm run build
```
Expected: 에러 없이 빌드 성공

- [ ] **Step 2: 전체 페이지 동작 확인**

브라우저에서 각 경로 접속하여 확인:
- `/` — 일별 대시보드
- `/weekly` — 주별 뷰
- `/monthly` — 월별 뷰
- `/tasks` — 일감 목록 + 필터
- `/tasks/new` — 일감 등록
- `/tasks/{id}` — 일감 상세/수정
- `/tasks/trash` — 휴지통
- `/settings` — 설정

- [ ] **Step 3: CRUD 플로우 테스트**

1. /tasks/new에서 일감 등록
2. /tasks에서 필터로 조회
3. 일감 카드 클릭 → 상세 수정
4. 타이머 시작 → 종료 → 소요시간 확인
5. 일감 삭제 → /tasks/trash에서 복구

- [ ] **Step 4: 커밋 (수정 있을 경우)**

```bash
git add .
git commit -m "fix: resolve build issues and polish UI"
```
