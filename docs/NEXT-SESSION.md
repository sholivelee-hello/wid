# WID — 다음 세션 가이드

**마지막 작업일:** 2026-04-29
**현재 상태:** Supabase + Slack 실연동 완료. 위임=완료 처리, 휴지통 영구 삭제, 히스토리 주중 모드 등 UX 일괄 개선 완료. 다음은 Notion 연동.

---

## 현재 앱 상태 요약

- `/` — 인박스 (Supabase 실데이터, Slack task 자동 생성). 필터에 요청자/위임자 추가됨.
- `/today` — 오늘 (task 목록 + 타임라인. GCal 미연동으로 이벤트 없음)
- `/history` — 히스토리 (월~금 5일제 캘린더 + 검색)
- `/settings` — Slack 연결 상태 자동 확인. GCal 미연동.
- `/tasks/trash` — 휴지통. 복구 + 영구 삭제 + 휴지통 비우기

## 연동 상태

| 서비스 | 상태 | 비고 |
|---|---|---|
| Supabase | ✅ 실연결 | merdoqdtujfnickbgmhz.supabase.co |
| Slack | ✅ 실연결 | TASK줍줍봇, reaction_added → task 생성. `auth.test`로 연결 확인 |
| Google Calendar | ❌ 미연동 | 빈 상태로 표시 중 |
| Notion | 🟡 부분 | sync API는 있으나 미검증 — **다음 세션에서 마무리** |

## Slack 운영 주의사항

- 개발 서버 실행 후 cloudflared 터널 별도로 켜야 함:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
- 나온 URL을 Slack App → Event Subscriptions → Request URL에 등록 (재시작하면 URL 바뀜)
- 봇이 이모지 달린 채널에 멤버로 있어야 함 (`/invite @TASK줍줍봇`)
- 트리거: `:send-away:` → task 생성 / `:완료:` → task 완료 (현재 완료 이모지는 동작 미검증, 설정 UI에서 안내 제거됨)

---

## 다음 세션에서 해야 할 일 (우선순위순)

### 1순위: Notion 실연동

- 현재 `src/app/api/notion/sync/route.ts`에 sync API 있음. 인박스 마운트 시 호출되지만 실제로 동작하는지 미검증.
- 환경변수: `NOTION_TOKEN`, `NOTION_DATABASE_ID` 필요 — `.env.local` 확인.
- 흐름: Notion DB의 row → WID task로 import. notion_task_id 매칭으로 중복 방지.
- 필요한 작업:
  1. `.env.local`에 Notion 토큰/DB ID 채우기
  2. `/api/notion/sync` route 재검토 — 실제 Notion API 호출 + 데이터 매핑
  3. 설정 페이지에 Notion 카드 추가 (현재 없음). Slack처럼 "연결 확인" 버튼.

### 2순위: Google Calendar 실연동

- `src/lib/gcal-events.ts` 코드 있음
- `/settings`의 GCal 섹션에서 OAuth 로그인
- 구독할 캘린더 선택 → 사이드바 + 오늘/히스토리에 이벤트 표시
- 현재 GCalSettings는 SSR-safe 처리됨 (DEFAULT 초기값 → 마운트 후 localStorage)

### 3순위: Vercel 배포

- 환경변수 등록: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_*`, `NOTION_*` 등
- 배포 후 cloudflared 터널 없이 Slack webhook 영구 동작.

### 4순위: 알려진 미해결 사항

- Slack 완료 이모지 동작 디버깅 (현재 reaction_added로 들어오는데 task가 매칭 안 됨)
- 모바일 히스토리 레이아웃
- `/api/stats/*` 정리 (사용하지 않는 라우트)

---

## 이번 세션에 추가/변경된 것 (2026-04-29)

### 새 헬퍼 / 도메인 모델
- `isTaskDone(status)` (`src/lib/types.ts`): 완료 || 위임 = 처리됨. 인박스/오늘 카운트, 시각 처리, 트리 lock guard, prompt-next 모두 이 헬퍼 기준.

### 새 API endpoint
- `GET /api/slack/test` — Slack `auth.test`로 봇 토큰 유효성 확인 (team/user 반환)
- `DELETE /api/tasks/[id]/purge` — 휴지통 task 영구 삭제 (자식까지 함께 제거, is_deleted=true 안전 가드)
- `DELETE /api/tasks/purge` — 휴지통 비우기

### UX 변경
- TaskDetailPanel: 저장 성공 시 모달 자동 닫힘. 모달/삭제 다이얼로그 제목이 sub-TASK / TASK 분기.
- 인박스 필터에 **요청자**, **위임 대상** 칩 추가 (값 없으면 안내 문구).
- Today/History/Settings 페이지 `max-w` 제거 — 전체 너비 사용.
- 휴지통 카드에 **TASK / sub-TASK 배지** + 부모 제목 표시.
- IssuePicker: 모든 task가 처리됨인 ISSUE는 기본 숨김 + "완료된 ISSUE도 보기 (N)" 토글.
- 인박스 트리: active task가 0개인 ISSUE 자동 숨김 (모든 task 휴지통 → ISSUE도 안 보임).
- buildTree 고아 처리 — 부모/ISSUE가 사라진 sub-task도 인박스에서 보이게.
- 히스토리 캘린더: **월~금 5일제** (토/일 컬럼 제거).
- 히스토리 일정 칩: 텍스트 색을 foreground로 (노란색 캘린더에서도 가독).
- Slack settings UI 단순화: 트리거 이모지 + 연결 확인 버튼만. 마운트 시 자동 확인.

### Hydration / SSR 안전 패치
- `Sidebar`, `GCalSettings`, `EventMonthGrid`, `DayDetailPanel`, `WeekDetailPanel` — localStorage 의존 state를 DEFAULT로 초기화하고 마운트 후 동기화.

### 사이드바 인박스 카운트
- sub-task도 포함 (트리 빌더가 고아 sub-task를 표면화하므로 일관성 있음).
- 위임/완료/취소/삭제는 제외.

---

## 주요 파일 위치

- **DB 스키마**: `supabase/migrations/001_initial_schema.sql`, `002_hierarchy_and_issues.sql`
- **Slack webhook**: `src/app/api/slack/webhook/route.ts`
- **Slack 연결 확인**: `src/app/api/slack/test/route.ts`
- **휴지통 영구 삭제**: `src/app/api/tasks/[id]/purge/route.ts`, `src/app/api/tasks/purge/route.ts`
- **GCal 실API 로직**: `src/lib/gcal-events.ts`
- **Notion sync**: `src/app/api/notion/sync/route.ts` (다음 세션 작업 대상)
- **아키텍처 문서**: `docs/architecture/`
- **스펙/플랜**: `docs/superpowers/specs/`, `docs/superpowers/plans/`
