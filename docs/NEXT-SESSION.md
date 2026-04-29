# WID — 다음 세션 가이드

**마지막 작업일:** 2026-04-30
**현재 상태:** Notion 실연동 완료 (token + 2개 DB, 124건 task import). Slack webhook 견고화, 인박스 필터/정렬 일괄 정비, 전역 펼치기/접기, TaskDetailPanel 완료일시 편집까지. 다음은 GCal 실연동 및 배포.

---

## 현재 앱 상태 요약

- `/` — 인박스. Supabase + Slack + Notion 모두 실데이터. 필터 5종(우선순위/출처/상태/요청자/위임자) 메인 트리에 적용. 정렬 6종(최근 추가/우선순위/마감일/이름/요청자/출처).
- `/today` — 오늘 task + 타임라인 (GCal 이벤트는 미연동으로 비어있음)
- `/history` — 월~금 5일제 캘린더 + 검색. GCal 이벤트 중복 key 에러 수정됨.
- `/settings` — Slack 송신/수신 상태, Notion(현재 카드 없음 — 추가 후보), GCal 미연동
- `/tasks/trash` — 휴지통

## 연동 상태

| 서비스 | 상태 | 비고 |
|---|---|---|
| Supabase | ✅ 실연결 | merdoqdtujfnickbgmhz. MCP로 마이그레이션 직접 적용 가능 |
| Slack | ✅ 실연결 | auth.test 통과. 웹훅 도달은 cloudflared 터널 필요 |
| Notion | ✅ 실연결 | NOTION_API_KEY + DB_ID_1/2 채워짐. app.notion.com 정식 URL 저장 |
| Google Calendar | ❌ 미연동 | OAuth 로그인 필요 |

## Slack 운영 주의사항

- 개발 서버 실행 후 cloudflared 별도로 켜야 함:
  ```
  cloudflared tunnel --url http://localhost:3000
  ```
- 나온 URL을 Slack App → Event Subscriptions → Request URL에 등록 (재시작하면 URL 바뀜)
- 봇이 채널에 멤버여야 함 (`/invite @TASK줍줍봇`)
- `/settings`의 Slack 카드 "수신" 행이 도달 여부를 보여줌. "도달 없음"이면 cloudflared/Request URL 점검 신호

---

## 다음 세션 작업 (우선순위순)

### 1순위: Google Calendar 실연동
- `src/lib/gcal-events.ts` 코드 + GCalSettings는 SSR-safe 처리됨
- `/settings`에서 GIS implicit-flow OAuth 로그인 → 구독 캘린더 선택 → 사이드바/오늘/히스토리에 이벤트 표시
- env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 채워져있음 (305618870138-...)
- 검증 포인트: 이벤트 dedupe (오늘 이미 패치됨 — 같은 이벤트가 여러 캘린더에서 와도 한 번만 표시), recurring 인스턴스, 종일 이벤트

### 2순위: Vercel 배포
- 환경변수 등록: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID_1/2`, `SLACK_*`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- 배포 후 cloudflared 없이 Slack webhook 영구 동작 (Slack Request URL을 Vercel 도메인으로 변경)
- 도메인 결정 + Notion sync cron 설정 검토

### 3순위: 설정 페이지에 Notion 카드 추가
- 현재 Notion 연동은 살아있는데 `/settings`에 카드가 없음
- Slack 카드와 동일하게 "연결 확인" 버튼 + 마지막 sync 시각 + 마지막 import 건수 표시
- `/api/notion/status` 같은 엔드포인트 추가 후 카드 마운트 시 자동 호출

### 4순위: 알려진 미해결 사항
- **Slack 완료 이모지** — `:완료:` reaction 발생 시 task 완료 처리가 동작 미검증. 디버깅 필요. 코드는 webhook route에 살아있고 실제 webhook 도달이 보장된 상황(2순위 배포 후)에서 재검증
- **모바일 히스토리 레이아웃** 검토
- `/api/stats/*` 정리 (사용 안 하는 라우트)
- `tasks.notion_issue` 컬럼은 스키마에 없음 — `Task` 타입에는 남아있어 정리 후보 (현재 task-detail-panel.tsx 일부에서 참조)

---

## 이번 세션에 추가/변경된 것 (2026-04-30)

### Notion
- `.env.local`: `NOTION_API_KEY`, `NOTION_DATABASE_ID_1/2` 채움 (placeholder → 실값)
- `src/app/api/notion/sync/route.ts`:
  - SDK v5 마이그레이션: `databases.query` → `databases.retrieve` + `dataSources.query`
  - status check 위반 수정: `'대기'` → `'등록'`
  - 존재하지 않는 `notion_issue` 컬럼 참조 제거
  - 제목 파싱 폴백: `이름/Name/제목`이 없을 때 `Object.values(props)`에서 type='title' 탐지
  - requester는 본인이 아니라 Notion `요청자/Requester` property에서 추출 (없으면 null)
  - insert/update 모두 error 로깅 추가 (silent fail 방지)
  - `page.url`을 `notion_url` 컬럼에 저장 — teamspace 페이지도 정확히 라우팅
- 마이그레이션 003: `notion_url text` 컬럼 추가 (Supabase MCP로 적용)
- `src/lib/utils.ts`: `getNotionPageUrl`을 `www.notion.so` fallback으로 (저장된 URL 우선 사용)

### Slack
- `src/app/api/slack/webhook/route.ts`:
  - dedup insert를 reaction 필터 통과 후로 이동 → `slack_events`가 의미있는 inbound 신호
  - task insert / 완료 update / dedup insert 모두 error 로깅
  - `.single()` → `.maybeSingle()`
- 신규 `GET /api/slack/inbound-status` — 마지막 webhook 도달 시각 + 24h 건수
- `SlackSettings`: "수신" 행 추가 (도달/대기/도달 없음 + 안내 문구)

### 인박스 UX
- 필터 popover 5종(우선순위/출처/상태/요청자/위임자) 모두 메인 트리에 적용. top-level TASK 매칭 → sub-task 따라옴 (3-level invariant)
- 정렬 옵션 6종으로 확장: 최근 추가/우선순위/마감일/**이름**/**요청자**/**출처** (한국어 localeCompare, null/빈값 항상 마지막)
- 헤더에 전역 펼치기/접기 (ChevronsUpDown / ChevronsDownUp). `useCollapsed` 훅이 `wid:tree-set-all` 이벤트 listen + localStorage 정리 → 모든 페이지에서 작동
- GCal 이벤트 중복 key 에러: `fetchEventsForRange` 끝에서 `id` 기준 dedupe (히스토리/오늘/주간뷰 등 모든 소비자 일괄 적용)

### TaskDetailPanel
- "완료일시" datetime-local 필드 (status='완료'일 때만 표시) — 표시 + 편집 가능
- "위임 대상" 필드는 status='위임'일 때만 노출 (이전엔 항상 표시)
- ISO ↔ datetime-local timezone-safe 변환 헬퍼

### 새 헬퍼 / 도메인
- `src/lib/use-tree-collapsed.ts`: `broadcastTreeSetAll(collapsed)` + `TREE_SET_ALL_EVENT` 이벤트
- `src/lib/custom-views.ts`: `SORT_LABEL` export, `SortKey` 6종으로 확장

---

## 주요 파일 위치

- **DB 스키마**: `supabase/migrations/001_initial_schema.sql`, `002_hierarchy_and_issues.sql`, **`003_notion_url.sql`** (신규)
- **Slack webhook**: `src/app/api/slack/webhook/route.ts`
- **Slack 연결 확인**: `src/app/api/slack/test/route.ts` (송신), `src/app/api/slack/inbound-status/route.ts` (수신, 신규)
- **Notion sync**: `src/app/api/notion/sync/route.ts`
- **GCal API 로직**: `src/lib/gcal-events.ts` (dedupe 추가됨)
- **트리 펼치기/접기**: `src/lib/use-tree-collapsed.ts` + `src/components/layout/header.tsx`
- **아키텍처 문서**: `docs/architecture/`
- **스펙/플랜**: `docs/superpowers/specs/`, `docs/superpowers/plans/`

## Supabase MCP

- 인증 완료 (Shinhee Personal 조직). 다음 세션에서도 유지될 가능성이 높음
- DDL 변경은 `mcp__plugin_supabase_supabase__apply_migration` 직접 호출 가능 (project_id: `merdoqdtujfnickbgmhz`)
- 데이터 조회는 `execute_sql`
