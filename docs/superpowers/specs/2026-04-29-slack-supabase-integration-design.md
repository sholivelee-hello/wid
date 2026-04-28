# WID Slack + Supabase 실연동 설계

**날짜:** 2026-04-29
**목표:** mock 데이터 전체 제거 + Supabase 실연결 + Slack 이모지 → task 생성 실동작

---

## 배경

현재 앱은 가짜 데이터(`mock-data.ts`, `mock-gcal.ts`, `mock-calendars.ts`)로 동작 중.
Supabase, Slack, GCal 연동 코드는 이미 작성되어 있으나 실제로 연결되지 않은 상태.

## 목표 상태

- `mock-data.ts`, `mock-gcal.ts`, `mock-calendars.ts` 삭제
- 모든 task/issue 데이터는 Supabase에서 읽고 씀
- Slack에서 `:send-away:` 이모지 반응 → WID 인박스에 task 자동 생성
- Slack에서 `:완료:` 이모지 반응 → 해당 task 완료 처리
- GCal: 미연결 상태이면 빈 슬롯으로 표시 (OAuth 연동은 별도 작업)

## 담당 구분

| 단계 | 담당 | 내용 |
|---|---|---|
| 1 | 사용자 | Supabase 새 프로젝트 생성, URL + anon key 복사 |
| 2 | Claude | mock 데이터 삭제, Supabase 클라이언트 활성화, 컴포넌트 교체 |
| 3 | 사용자 | api.slack.com에서 앱 생성, Bot Token + Signing Secret 복사 |
| 4 | 사용자 | ngrok http 3000 실행, URL 복사 |
| 5 | Claude | Slack Event Subscriptions URL 등록 안내, env 파일 세팅 |
| 6 | 둘이 | 이모지 달아서 task 생성 E2E 확인 |

## 데이터 흐름

```
[Slack] :send-away: 이모지
  → POST /api/slack/webhook
  → 서명 검증 (SLACK_SIGNING_SECRET)
  → conversations.history API로 원본 메시지 조회 (SLACK_BOT_TOKEN)
  → Supabase tasks 테이블 insert
  → 인박스 페이지에서 자동 반영

[브라우저] 인박스/오늘/히스토리 페이지
  → Supabase 쿼리로 tasks, issues 조회
  → 렌더링

[GCal] 미연결이면 빈 상태, 연결 안내 메시지 표시
```

## 환경변수 목록

`.env.local`에 세팅해야 하는 값:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
NEXT_PUBLIC_SLACK_TRIGGER_EMOJI=send-away
NEXT_PUBLIC_SLACK_COMPLETE_EMOJI=완료
```

## Slack 앱 필요 권한 (Bot Token Scopes)

- `channels:history` — 메시지 내용 읽기
- `groups:history` — 비공개 채널 메시지 읽기
- `users:read` — 메시지 보낸 사람 이름 조회

## Slack Event Subscriptions 설정

- Request URL: `https://<ngrok-url>/api/slack/webhook`
- Subscribe to bot events: `reaction_added`

## 제거 대상 파일

- `src/lib/mock-data.ts`
- `src/lib/mock-gcal.ts`
- `src/lib/mock-calendars.ts`
- 위 파일을 import하는 모든 컴포넌트/페이지의 해당 import 및 참조

## GCal 처리 방침

OAuth 연동은 이번 범위 밖. 캘린더 관련 UI는:
- 사이드바 캘린더 패널: 빈 상태 + "캘린더 연동 필요" 안내
- 오늘/히스토리 페이지 이벤트 영역: 빈 슬롯 표시

## 성공 기준

1. 앱 실행 시 가짜 데이터 없이 빈 인박스로 시작
2. Slack에서 `:send-away:` 이모지 → WID 인박스에 task 나타남
3. Slack에서 `:완료:` 이모지 → 해당 task 완료 처리됨
