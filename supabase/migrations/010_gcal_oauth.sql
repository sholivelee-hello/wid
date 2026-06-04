-- Google Calendar OAuth — Authorization Code flow 전환 (2026-06-04).
-- 기존 GIS implicit flow(브라우저 1시간 토큰, localStorage)는 매번 재연동이
-- 필요했음. 이제 서버가 refresh_token을 보관하고 access token을 자동 갱신한다.
-- 단일 사용자 앱이라 행은 항상 1개 (id = 'default').

create table if not exists gcal_oauth (
  id text primary key default 'default',
  refresh_token text not null,
  email text,
  updated_at timestamptz not null default now()
);
