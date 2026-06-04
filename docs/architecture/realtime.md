# Realtime — 웹훅/sync → 열린 화면 자동 갱신

서버 DB에 task가 생기는 순간, 열려 있는 브라우저가 목록을 다시 불러오게 한다.
Supabase Realtime **Broadcast**를 쓴다 (postgres_changes 아님 — 데이터를 싣지 않음).

## 채널

- 채널/topic: `wid-tasks`, event: `changed`, payload: `{ source }` (식별용, 화면은 무시).

## 송신 (서버, 3곳)

`broadcastTasksChanged(source)` — `src/lib/realtime-broadcast.ts`.
`${NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`에 service role 키로 POST.
fire-and-forget(실패해도 throw 안 함, 키/URL 없으면 no-op), await + 3초 timeout.

- `src/app/api/jira/webhook/route.ts` — task insert 성공 후 `('jira')`.
- `src/app/api/slack/webhook/route.ts` — reaction_added·jira-relay task insert 성공 후 `('slack')`.
- `src/app/api/notion/sync/route.ts` — 응답 직전, `created + updated > 0`일 때만 `('notion')`.

## 수신 (브라우저)

`src/components/layout/realtime-bridge.tsx` (`'use client'`, null 렌더, layout.tsx 마운트).
`supabase`(anon, `src/lib/supabase/client.ts`)로 `channel('wid-tasks')` 구독 →
broadcast 수신 시 600ms debounce 후 `window.dispatchEvent(new CustomEvent('task-created'))`.
inbox/today/issues/이슈상세/사이드바 카운트가 이미 `task-created`를 듣고 `/api/tasks`를 재조회한다.

## RLS 전제 / 보안

- 서버 클라이언트는 service role 키로 전환됨 (`src/lib/supabase/server.ts`, RLS 우회).
- anon 키는 브라우저 Realtime 구독용으로 노출되므로, 전 테이블 RLS를 켜고(`003_enable_rls.sql`)
  정책을 만들지 않아 anon의 테이블 직접 접근을 전면 차단한다.
- broadcast 채널은 공개라 데이터를 싣지 않는다 — "변경 있음" 신호만 보내고,
  실제 목록은 기존 인증 경로(`/api/tasks`)로 다시 불러온다.
