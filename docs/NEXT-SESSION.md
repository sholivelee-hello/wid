# WID — 다음 세션 가이드

**마지막 작업일:** 2026-04-29
**현재 상태:** Supabase + Slack 실연동 완료. mock 데이터 전부 삭제됨.

---

## 현재 앱 상태 요약

- `/` — 인박스 (Supabase 실데이터, Slack task 자동 생성됨)
- `/today` — 오늘 (task 목록 + 타임라인. GCal 미연동으로 이벤트 없음)
- `/history` — 히스토리 (월 달력 + 검색)
- `/settings` — 설정 (Slack 연동 완료, GCal 미연동)
- 사이드바 캘린더 패널 — GCal 미연동으로 비어있음

## 연동 상태

| 서비스 | 상태 | 비고 |
|---|---|---|
| Supabase | ✅ 실연결 | merdoqdtujfnickbgmhz.supabase.co |
| Slack | ✅ 실연결 | TASK줍줍봇, reaction_added → task 생성 |
| Google Calendar | ❌ 미연동 | 빈 상태로 표시 중 |
| Notion | 부분 | sync API는 있으나 미검증 |

## Slack 운영 주의사항

- 개발 서버 실행 후 cloudflared 터널 별도로 켜야 함:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
- 나온 URL을 Slack App → Event Subscriptions → Request URL에 등록 (재시작하면 URL 바뀜)
- 봇이 이모지 달린 채널에 멤버로 있어야 함 (`/invite @TASK줍줍봇`)
- 트리거: `:send-away:` → task 생성 / `:완료:` → task 완료

---

## 다음 세션에서 해야 할 일 (우선순위순)

### 1순위: 앱 전체 동작 확인 + UI 피드백

```bash
npm run dev
# → http://localhost:3000
```

실제 데이터로 처음 쓰는 거라 이상한 부분 나올 수 있음. 확인할 것:
- [ ] 인박스: Slack task 카드 정상 표시, 상태 변경, 완료 처리
- [ ] 인박스: 수동 task 추가 → Supabase 저장 확인
- [ ] 오늘(`/today`): 오늘 task 표시 정상 여부
- [ ] 히스토리(`/history`): 달력 + 완료 task 조회
- [ ] 설정(`/settings`): Slack 섹션 테스트 전송 동작 확인

### 2순위: Google Calendar 실연동

현재 GCal 관련 코드는 이미 있음 (`src/lib/gcal-events.ts` — 실제 Google Calendar API 호출 로직). 연동하려면:

1. Google Cloud Console → OAuth 2.0 클라이언트 설정 (이미 client ID 있음: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
2. `/settings`의 GCal 섹션에서 OAuth 로그인
3. 구독할 캘린더 선택 → 사이드바 캘린더 패널 + 오늘/히스토리 이벤트 표시

### 3순위: Vercel 배포

```bash
# Vercel CLI 설치 후
vercel --prod
# 환경변수 등록 필요 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLACK_* 등)
```

배포하면 cloudflared 터널 없이도 Slack webhook 영구 동작.

### 4순위: 알려진 미해결 사항

- Error-handling UI — API 실패 시 retry/fallback (현재 toast만)
- 모바일 히스토리 레이아웃
- `/api/stats/*` 정리 (사용하지 않는 라우트)

---

## 주요 파일 위치

- **DB 스키마**: `supabase/migrations/001_initial_schema.sql`, `002_hierarchy_and_issues.sql`
- **Slack webhook**: `src/app/api/slack/webhook/route.ts`
- **GCal 실API 로직**: `src/lib/gcal-events.ts`
- **아키텍처 문서**: `docs/architecture/`
- **스펙/플랜**: `docs/superpowers/specs/`, `docs/superpowers/plans/`
