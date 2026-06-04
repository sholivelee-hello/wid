# Google Calendar 설정·헬퍼 (gcal-embed + OAuth)

> **/calendar 페이지는 제거됨. 캘린더 일정은 히스토리 페이지에 통합.**
>
> `getActiveCalendarIds`, `getCalendarColor`, `getCalendarLabel` 헬퍼는
> 히스토리 페이지가 소비하는 주체. 별도 refactor 에서 events.list fetching 이 히스토리에 연결된다.

---

## 설정 스키마 (`localStorage[wid-gcal-config]`)

```ts
interface GCalConfig {
  oauth: GCalOAuthState | null;                 // GIS 토큰 (accessToken + expiresAt + email)
  subscribedCalendars: SubscribedCalendar[];    // OAuth 후 calendarList.list 결과
}

interface SubscribedCalendar {
  id: string;
  summary: string;        // summaryOverride 우선, 없으면 summary
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

interface GCalOAuthState {
  accessToken: string;
  expiresAt: number;     // ms epoch
  email?: string;
  scope?: string;
}
```

레거시 localStorage 항목(`calendars`, `disabled`, `startHour`, `endHour`, `darkMode` 등 옛 필드)은
`getGCalConfig` 에서 읽을 때 자동으로 무시되고 `oauth` + `subscribedCalendars` 만 꺼낸다.

## 활성 캘린더 헬퍼

`src/lib/gcal-embed.ts` 가 export 하는 주요 헬퍼:

- `getActiveCalendarIds(config)` — `config.subscribedCalendars.map(c => c.id)`. 순서 보존.
  수동 입력·per-calendar 토글 UI 는 제거됨. 구독된 캘린더 전체가 기본 활성.
  나중에 필요하면 `disabled[]` 필드를 다시 도입할 수 있음.
- `getCalendarColor(id, config)` — subscribedCalendars 에서 backgroundColor, 없으면 결정론적 fallback 색
- `getCalendarLabel(id, config)` — subscribedCalendars.summary, 없으면 id 자체

히스토리 페이지에서 이벤트 목록을 렌더링할 때 이 헬퍼로 캘린더별 색상과 레이블을 결정한다.

## OAuth 흐름 (server-managed Authorization Code flow — 2026-06-04 전환)

기존 GIS implicit flow(브라우저 1시간 토큰, 만료마다 재로그인)는 폐기.
서버가 refresh_token을 보관하고 access token을 자동 갱신한다 — **한 번 연동하면 영구 유지**.

서버 라우트 (`src/app/api/gcal/oauth/*`, `token`, `disconnect`):
- `GET /api/gcal/oauth/start` — 구글 동의 화면으로 redirect. `access_type=offline&prompt=consent` (refresh_token 발급 보장). CSRF state 쿠키(`gcal_oauth_state`).
- `GET /api/gcal/oauth/callback` — code→토큰 교환, refresh_token을 `gcal_oauth` 테이블(단일 행 id='default', migration 010)에 upsert, `/settings?gcal=connected`로 복귀.
- `GET /api/gcal/token` — refresh_token으로 access token 재발급 후 `{connected, accessToken, expiresAt, email}` 반환. 모듈 캐시(만료 60초 전까지 재사용). `invalid_grant`(사용자가 구글에서 권한 회수) 시 행 삭제 후 `connected:false`.
- `POST /api/gcal/disconnect` — revoke(best-effort) + 행 삭제.

클라이언트 (`src/lib/gcal-oauth.ts`):
- `ensureFreshOAuth()` — 로컬 토큰 유효하면 그대로, 만료/없음이면 `/api/gcal/token` 호출해 `GCalConfig.oauth` 갱신(+`GCAL_EMBED_EVENT` broadcast). 동시 호출은 in-flight promise 공유. 서버에 연동 없으면 stale 로컬 oauth를 지워 UI 거짓 "연동됨" 방지.
- 만료 검사: `isTokenExpired(state, skewMs=60_000)` (60초 여유)
- 호출 계약: **Google API를 부르는 모든 곳은 `config.oauth`를 직접 읽지 말고 `ensureFreshOAuth()`를 거친다** (today/history 페이지, 설정 카드 적용됨).

스코프: `openid email https://www.googleapis.com/auth/calendar.readonly`
필수 env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (서버 전용, 없으면 start가 `?gcal=error&reason=not_configured`로 복귀)
Google Cloud Console에 redirect URI 등록 필요: `{origin}/api/gcal/oauth/callback` (prod + localhost:3000).

`src/lib/gcal-api.ts`:
- `fetchSubscribedCalendars(token)` → `calendarList?minAccessRole=reader&maxResults=250`
- `fetchUserEmail(token)` → `oauth2/v2/userinfo` (현재 미사용 — email은 callback에서 저장)

## 설정 UI (`src/components/settings/gcal-settings.tsx`)

단일 카드, Google 로그인 상태만 표시:

- **env 미설정**: `.env.local` 설정 안내 텍스트
- **미로그인**: `CalendarDays` 아이콘 + 설명 + "Google 계정으로 로그인" 버튼
- **로그인됨**: `✓ 연동됨: <email>` + `내 일정 N개 캘린더에서 가져옵니다` + 구독 목록 새로고침 / 연결 해제 버튼

토글 리스트, 수동 textarea, 시간 범위, 테마 섹션은 모두 제거됨.

## 관련 파일

- `src/lib/gcal-embed.ts` — config get/set, 활성 캘린더/색상/레이블 헬퍼
- `src/lib/gcal-oauth.ts` — `ensureFreshOAuth()`, 만료 검사
- `src/app/api/gcal/oauth/start|callback`, `api/gcal/token`, `api/gcal/disconnect` — 서버 OAuth + 자동 갱신
- `src/lib/gcal-api.ts` — calendarList.list, userinfo fetch
- `src/components/settings/gcal-settings.tsx` — Google 로그인 단일 카드

## 운영 메모

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 가 없으면 OAuth UI 가 안내 블록으로 자동 대체됨.
- access token 만료는 사용자에게 보이지 않음 — `ensureFreshOAuth()`가 서버 재발급으로 흡수. 재로그인이 다시 필요해지는 유일한 경우는 구글 보안 화면에서 앱 권한을 직접 회수했을 때(`invalid_grant`).
- 구독 캘린더 목록은 캐시 — 새 캘린더 구독했으면 "구독 목록 새로고침" 클릭.

## 미정리 영역

히스토리 페이지의 캘린더 위젯들은 아직 `mock-gcal.ts` mock 이벤트 사용 중. 풀 events.list API 전환은 별도 작업.
