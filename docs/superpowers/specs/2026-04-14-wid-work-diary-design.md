# WID - Work Diary (업무일지 시스템) Design Spec

## Overview

개인 업무일지 + 일감 관리 시스템. 노션 Task DB, 슬랙과 연동하여 일감을 통합 관리하고, 일별/주별/월별 대시보드로 업무 현황을 한눈에 파악할 수 있는 웹 앱.

## Context

- **사용자**: 1명 (개인 전용)
- **환경**: 현재 Windows, 곧 Mac 전환 예정 → 웹 앱으로 OS 무관하게 사용
- **인증**: 없음 (개인 사용)
- **핵심 가치**: 대시보드 — 일별/주별/월별 현황 파악이 가장 중요

## Tech Stack

| 영역 | 기술 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 14+ (App Router) | 풀스택, SSR, API Routes 통합 |
| UI | Tailwind CSS + shadcn/ui | 빠른 개발, 깔끔한 디자인 |
| 차트 | Recharts | React 친화적, 가볍고 커스터마이징 용이 |
| DB | Supabase (PostgreSQL) | 무료, 실시간, SQL 통계 쿼리에 강함 |
| 배포 | Vercel | Next.js 최적, 무료 플랜 |
| 상태관리 | Zustand | 가볍고 간단 (타이머 상태 등) |

## Data Model

### Task (일감)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| title | text (NOT NULL) | 일감 제목 |
| description | text (nullable) | 상세 설명 |
| priority | enum | `긴급` / `높음` / `보통` / `낮음` |
| status | text (NOT NULL) | 기본: `대기` / `진행중` / `완료` / `위임` / `취소` / `보류` / `부분완료` + 사용자 커스텀 |
| source | enum | `manual` / `notion` / `slack` |
| requester | text (nullable) | 요청한 사람 이름 |
| requested_at | timestamptz (nullable) | 요청 받은 날짜 |
| created_at | timestamptz (NOT NULL, default now()) | 등록일 |
| deadline | timestamptz (nullable) | 마감일 |
| started_at | timestamptz (nullable) | 시작 버튼 누른 시간 |
| completed_at | timestamptz (nullable) | 완료한 날짜 |
| actual_duration | integer (nullable) | 실제 소요시간 (분 단위, 수정 가능) |
| is_duration_manual | boolean (default false) | 수동 수정 시 true — 이후 TimeLog 합산 자동 덮어쓰기 방지 |
| notion_task_id | text (nullable, UNIQUE) | 노션 원본 Task ID |
| slack_url | text (nullable) | 슬랙 메시지 URL |
| slack_channel | text (nullable) | 슬랙 채널명 |
| slack_sender | text (nullable) | 슬랙 메시지 보낸 사람 |
| delegate_to | text (nullable) | 위임 대상 |
| follow_up_note | text (nullable) | 후속 작업 메모 |
| is_deleted | boolean (default false) | 소프트 삭제 플래그 |

### CustomStatus (커스텀 상태)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| name | text (NOT NULL, UNIQUE) | 상태 이름 |
| color | text (NOT NULL) | 표시 색상 (hex) |
| created_at | timestamptz (default now()) | 생성일 |

### TimeLog (타이머 기록)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| task_id | UUID (FK → Task.id) | 연결된 일감 |
| started_at | timestamptz (NOT NULL) | 시작 시간 |
| ended_at | timestamptz (nullable) | 종료 시간 |

> 하나의 일감에 여러 TimeLog 가능 (중간에 멈췄다가 재개 가능). 완료 시 자동 합산 → actual_duration에 기록, 수동 수정 가능.
> 수동 수정 시 `is_duration_manual = true`로 설정되며, 이후 TimeLog 추가 시 자동 합산이 덮어쓰지 않음.

### Database Indexes

| 인덱스 | 대상 | 이유 |
|--------|------|------|
| `idx_task_status_deleted` | `Task(status, is_deleted)` | 목록 필터링 성능 |
| `idx_task_created_at` | `Task(created_at)` | 일별/주별/월별 통계 |
| `idx_task_completed_at` | `Task(completed_at)` | 완료 기준 통계 |
| `idx_task_notion_id` | `Task(notion_task_id)` UNIQUE | 노션 중복 방지 |
| `idx_timelog_task_started` | `TimeLog(task_id, started_at)` | 타이머 이력 조회 |

### Status 관리 정책

- `status` 필드는 text 타입 유지 (커스텀 상태 지원)
- 기본 상태 7개 (`대기`/`진행중`/`완료`/`위임`/`취소`/`보류`/`부분완료`)는 앱 코드에서 상수로 관리
- `CustomStatus` 테이블은 사용자 추가 상태만 저장
- Task.status 값은 기본 상태 상수 목록 + CustomStatus.name 목록에 포함되어야 함 (앱 레벨 검증)

## Core Features

### 1. 일감 CRUD

**생성 (Create)**
- 수동 등록: 제목(필수), 우선순위, 마감일, 요청자, 요청일, 설명 입력
- 노션 동기화: 노션 Task DB에서 제목/상태/담당자/마감일 가져와서 일감 생성
- 슬랙 자동 등록: 이모지 리액션 → 웹훅 → 메시지 내용/보낸 사람/URL/채널명으로 일감 자동 생성

**조회 (Read)**
- 일감 목록: 필터(상태, 우선순위, 출처, 기간) + 정렬(등록일, 마감일, 우선순위)
- 일감 상세: 모든 필드 + 타이머 이력 확인

**수정 (Update)**
- 모든 필드 수정 가능
- 상태 변경 시: `위임`이면 위임 대상 입력, `완료`면 후속 메모 입력 가능

**삭제 (Delete)**
- 소프트 삭제 (is_deleted = true), 복구 가능

### 2. 타이머

- 일감 카드에 시작(▶) / 종료(⏹) 버튼
- 시작 누르면 TimeLog 생성, 종료 누르면 ended_at 기록
- 하루에 여러 번 시작/종료 가능
- **동시 타이머 정책**: 한 번에 하나의 일감만 타이머 실행 가능. 다른 일감의 시작 버튼을 누르면 현재 실행 중인 타이머가 자동 종료되고 새 타이머 시작.
- 일감 완료 처리 시: TimeLog 합산 → actual_duration 자동 계산 → 수동 수정 가능 (`is_duration_manual` 플래그 설정)

### 3. 커스텀 상태 관리

- 설정 화면에서 상태 추가/수정/삭제
- 색상 지정 가능
- 기본 상태(대기/진행중/완료/위임/취소/보류/부분완료)는 삭제 불가

## Dashboard & Views

### 일별 뷰 (Daily) — 메인 화면

- **오늘의 일감 리스트**: 오늘 등록/진행/완료한 일감 카드들
- **타임라인**: 시간대별로 어떤 일감에 시간을 썼는지 가로 막대 차트
- **요약 카드**: 완료 건수, 총 소요시간, 진행중인 일감 수

### 주별 뷰 (Weekly)

- **캘린더 히트맵**: 월~금 각 날짜에 일감 완료 건수를 색 농도로 표시
- **일감 흐름 리스트**: 각 날짜별로 완료/추가된 일감 그룹핑
- **주간 통계**:
  - 완료 건수 / 위임 건수 / 취소 건수
  - 우선순위별 분포 (파이 차트)
  - 출처별 분포 — 수동 vs 노션 vs 슬랙 (파이 차트)
  - 일평균 소요시간 (바 차트)

### 월별 뷰 (Monthly)

- **캘린더 히트맵**: 한 달 전체를 히트맵으로 — 바쁜 날 한눈에 파악
- **월간 통계**:
  - 총 완료/위임/취소 건수 추이 (라인 차트)
  - 주차별 비교 (바 차트)
  - 우선순위별 / 출처별 / 상태별 분포
  - 평균 처리 시간 (등록~완료)

### 공통 요소

- 날짜 이동: 이전/다음 버튼 + 날짜 선택 피커
- 필터: 상태, 우선순위, 출처별 필터링

## Integrations

### Notion 연동

- **Notion API** (공식 API + Integration Token) 사용
- 수동 동기화 버튼: 클릭 시 노션 Task DB에서 일감 가져옴
- 가져오는 정보: 제목, 상태, 담당자, 마감일
- `notion_task_id`로 중복 방지
- **동기화 정책**: 이미 가져온 일감은 노션에서 변경된 경우 업데이트 (제목/상태/마감일). 단, WID에서 수동 수정한 필드는 덮어쓰지 않음 (노션 우선 vs WID 우선: WID에서 상태를 직접 변경한 경우 WID 우선).
- 노션 상태 → WID 상태 매핑 테이블 (설정에서 관리)

### Slack 연동

- **Slack App** 생성 → Event Subscription (`reaction_added` 이벤트)
- 내가 특정 이모지 리액션을 달면 → 슬랙이 웹훅으로 Next.js API Route 호출
- **보안**: Slack Signing Secret (`X-Slack-Signature` 헤더)으로 요청 검증. 검증 실패 시 403 반환.
- **멱등성**: Slack `event_id`를 기록하여 중복 이벤트 무시 (Slack은 3초 내 미응답 시 재전송)
- API Route에서 Slack API로 메시지 상세 정보 조회 → 일감 자동 생성
- 저장 정보: 메시지 내용(title), 보낸 사람(slack_sender), 메시지 URL(slack_url), 채널명(slack_channel)
- 트리거 이모지: 환경변수로 설정 가능

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  Slack App   │────▶│  Next.js     │────▶│ Supabase  │
│  (Webhook)   │     │  API Routes  │     │ (Postgres)│
└─────────────┘     │              │     └───────────┘
                    │  App Router   │
┌─────────────┐     │  (React SSR) │
│  Notion API │◀───▶│              │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Vercel     │
                    │  (Hosting)   │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │   Browser    │
                    │  (사용자)     │
                    └──────────────┘
```

### API Routes

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/tasks` | GET | 일감 목록 조회 (필터/정렬) |
| `/api/tasks` | POST | 일감 생성 |
| `/api/tasks/[id]` | GET | 일감 상세 조회 |
| `/api/tasks/[id]` | PATCH | 일감 수정 |
| `/api/tasks/[id]` | DELETE | 일감 소프트 삭제 |
| `/api/tasks/[id]/restore` | POST | 삭제된 일감 복구 |
| `/api/tasks/[id]/timer/start` | POST | 타이머 시작 |
| `/api/tasks/[id]/timer/stop` | POST | 타이머 종료 |
| `/api/tasks/[id]/timelogs` | GET | 타이머 이력 조회 |
| `/api/notion/sync` | POST | 노션 동기화 실행 |
| `/api/slack/webhook` | POST | 슬랙 이벤트 수신 |
| `/api/stats/daily?date=YYYY-MM-DD` | GET | 일별 통계 |
| `/api/stats/weekly?week_start=YYYY-MM-DD` | GET | 주별 통계 (월요일 기준) |
| `/api/stats/monthly?month=YYYY-MM` | GET | 월별 통계 |
| `/api/custom-statuses` | GET, POST | 커스텀 상태 목록 조회 / 생성 |
| `/api/custom-statuses/[id]` | PATCH, DELETE | 커스텀 상태 수정 / 삭제 |
| `/api/settings/notion-mapping` | GET/POST | 노션 상태 매핑 |

## Page Structure

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 (일별 뷰 — 오늘) |
| `/weekly` | 주별 뷰 |
| `/monthly` | 월별 뷰 |
| `/tasks` | 전체 일감 목록 (필터/정렬) |
| `/tasks/new` | 일감 수동 등록 |
| `/tasks/[id]` | 일감 상세/수정 |
| `/tasks/trash` | 삭제된 일감 목록 (복구 가능) |
| `/settings` | 설정 (커스텀 상태, 노션 매핑, 슬랙 이모지 설정) |

## Non-Goals (v1 범위 밖)

- 인증/로그인
- 다중 사용자 지원
- 모바일 네이티브 앱
- 알림/리마인더 기능
- 일감 간 의존성 관리
- 파일 첨부
