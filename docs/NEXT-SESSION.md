# WID — 다음 세션 가이드

**마지막 작업일:** 2026-04-30
**현재 상태:** Vercel 배포 완료 (wid-teal.vercel.app). GCal 오늘 일정 표시 추가. notion_issue 타입 잔재 정리. 다음은 Slack Request URL 교체 + GCal OAuth 활성화 검증.

---

## 현재 앱 상태 요약

- `/` — 인박스. Supabase + Slack + Notion 모두 실데이터. 필터 5종(우선순위/출처/상태/요청자/위임자) 메인 트리에 적용. 정렬 6종(최근 추가/우선순위/마감일/이름/요청자/출처).
- `/today` — 오늘 task + GCal 일정 섹션 (OAuth 연동 시 자동 표시). 일정별 컬러닷·시간·화상링크.
- `/history` — 월~금 5일제 캘린더 + 검색. GCal 이벤트 OAuth 연동 시 실데이터로 표시.
- `/settings` — Slack 송신/수신 상태, Notion 카드(수동 sync + 이력), GCal OAuth 카드 (로그인 버튼 있음)
- `/tasks/trash` — 휴지통

## 연동 상태

| 서비스 | 상태 | 비고 |
|---|---|---|
| Supabase | ✅ 실연결 | merdoqdtujfnickbgmhz. MCP로 마이그레이션 직접 적용 가능 |
| Slack | ✅ 실연결 (로컬) | Vercel 배포 후 Request URL 교체 필요 — 아래 참고 |
| Notion | ✅ 실연결 | NOTION_API_KEY + DB_ID_1/2 채워짐. 앱 시작 시 자동 sync |
| Google Calendar | ⚠️ 코드 준비됨 | /settings에서 "Google 계정으로 로그인" 클릭 필요. Vercel 도메인도 Google OAuth 승인 필요 |
| Vercel | ✅ 배포됨 | https://wid-teal.vercel.app |

## Slack 운영 주의사항

### 로컬 개발 시
- 개발 서버 실행 후 cloudflared 별도로 켜야 함:
  ```
  cloudflared tunnel --url http://localhost:3000
  ```
- 나온 URL을 Slack App → Event Subscriptions → Request URL에 등록 (재시작하면 URL 바뀜)
- 봇이 채널에 멤버여야 함 (`/invite @TASK줍줍봇`)

### Vercel 배포 후 (아직 미완료)
- Slack App → Event Subscriptions → Request URL을 `https://wid-teal.vercel.app/api/slack/webhook`으로 변경
- 이후 cloudflared 없이 Slack webhook 영구 동작

---

## 다음 세션 작업 (우선순위순)

### 1순위: Slack Request URL → Vercel 도메인으로 교체
- Slack App (api.slack.com) → Event Subscriptions → Request URL:
  `https://wid-teal.vercel.app/api/slack/webhook`
- 교체 후 `/settings` Slack 카드 수신 행이 "도달" 상태로 바뀌는지 확인
- 이후 **Slack 완료 이모지** (`:완료:` reaction → task 완료) 동작 검증 가능

### 2순위: Google OAuth 승인 도메인에 Vercel 추가
- Google Cloud Console → APIs & Services → OAuth 2.0 Client → 승인된 JavaScript 원본에 `https://wid-teal.vercel.app` 추가
- 그 후 https://wid-teal.vercel.app/settings 에서 "Google 계정으로 로그인" 클릭 → 구독 캘린더 선택
- 검증: 오늘 일정(/today), 히스토리 월 그리드에 GCal 이벤트 표시

### 3순위: SUPABASE_SERVICE_ROLE_KEY 등록
- `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY` 값이 placeholder (`여기에_직접_붙여넣기`)
- Supabase Dashboard → Project Settings → API → service_role key 복사
- `vercel env add SUPABASE_SERVICE_ROLE_KEY production` 으로 등록 후 재배포
- Server Route에서 RLS 우회 필요한 경우 사용

### 4순위: Notion sync cron 설정 (선택)
- 현재 앱 시작 시 1회 자동 sync. 배포 환경에서는 페이지 방문 시마다 trigger됨
- 주기적 강제 sync 원하면 Vercel Cron으로 `/api/notion/sync` POST 설정
  ```json
  // vercel.json
  { "crons": [{ "path": "/api/notion/sync", "schedule": "0 9 * * 1-5" }] }
  ```

### 5순위: 모바일 히스토리 레이아웃 검토
- `/history` 페이지 `lg:grid-cols-[1fr_320px]` — 모바일(single col)에서 패널이 길게 늘어남
- 모바일에서 detail panel을 sheet/drawer로 전환하는 방향 검토

---

## 이번 세션에 추가/변경된 것 (2026-04-30)

### GCal
- `/today` 페이지에 오늘 일정 섹션 추가
  - `fetchEventsForRange` + `GCAL_EMBED_EVENT` 구독으로 OAuth 연동 시 자동 fetch
  - 일정별: 캘린더 컬러닷, 시간범위(`HH:MM – HH:MM` / 종일), 제목, 화상회의 링크 아이콘, 장소 아이콘
  - OAuth 미연동 시 섹션 자체가 숨겨짐 (빈 UI 없음)

### Vercel 배포
- `vercel project add wid` → `vercel link` → 환경변수 12개 등록 → `vercel --prod`
- 배포 URL: https://wid-teal.vercel.app
- 등록된 env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID_1/2`, `SLACK_*` 6개, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- **미등록**: `SUPABASE_SERVICE_ROLE_KEY` (placeholder 값이라 건너뜀 — 3순위 참고)

### 코드 정리
- `Task` 타입에서 `notion_issue: string | null` 제거 (DB 스키마에 없는 열)
  - `task-card.tsx`, `task-detail-panel.tsx` 잔재 조건부 렌더링 제거
- `view-edit-form.tsx`: `SortKey` 타입 import — 확장된 6종 정렬 키 호환 (TypeScript 에러 수정)

---

## 주요 파일 위치

- **DB 스키마**: `supabase/migrations/001_initial_schema.sql`, `002_hierarchy_and_issues.sql`, `003_notion_url.sql`
- **Slack webhook**: `src/app/api/slack/webhook/route.ts`
- **Slack 연결 확인**: `src/app/api/slack/test/route.ts` (송신), `src/app/api/slack/inbound-status/route.ts` (수신)
- **Notion sync**: `src/app/api/notion/sync/route.ts`
- **GCal 오늘 이벤트**: `src/app/today/page.tsx` (fetchGCalEvents 함수)
- **GCal API 로직**: `src/lib/gcal-events.ts`
- **GCal OAuth**: `src/lib/gcal-oauth.ts`, `src/lib/gcal-api.ts`
- **아키텍처 문서**: `docs/architecture/`
- **스펙/플랜**: `docs/superpowers/specs/`, `docs/superpowers/plans/`

## Supabase MCP

- 인증 완료 (Shinhee Personal 조직). 다음 세션에서도 유지될 가능성이 높음
- DDL 변경은 `mcp__plugin_supabase_supabase__apply_migration` 직접 호출 가능 (project_id: `merdoqdtujfnickbgmhz`)
- 데이터 조회는 `execute_sql`
