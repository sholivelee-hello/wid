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

## OAuth 흐름 (Google Identity Services, implicit)

`src/lib/gcal-oauth.ts`:
- `loadGsiScript()` 가 `https://accounts.google.com/gsi/client` 를 lazy 로드 (10s 타임아웃, 모듈 단일톤 promise 캐시)
- `requestAccessToken()` → `google.accounts.oauth2.initTokenClient` + `requestAccessToken({prompt:'consent'})` 콜백을 promise 로 감쌈
- 만료 검사: `isTokenExpired(state, skewMs=60_000)` (60초 여유)
- 해제: `revokeAccessToken(token)` → `https://oauth2.googleapis.com/revoke` (best-effort)

스코프: `https://www.googleapis.com/auth/calendar.readonly`
필수 env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (없으면 OAuth UI 자체가 비활성화 안내로 대체)

`src/lib/gcal-api.ts`:
- `fetchSubscribedCalendars(token)` → `calendarList?minAccessRole=reader&maxResults=250`
- `fetchUserEmail(token)` → `oauth2/v2/userinfo` (signed-in-as 표시용)

보안 trade-off: implicit flow 는 access token 이 JS 컨텍스트에 노출됨. 1인 personal 앱 + read-only scope 라 수용. SaaS 화 한다면 server-side authorization code flow + httpOnly 쿠키로 전환 필요.

## 설정 UI (`src/components/settings/gcal-settings.tsx`)

단일 카드, Google 로그인 상태만 표시:

- **env 미설정**: `.env.local` 설정 안내 텍스트
- **미로그인**: `CalendarDays` 아이콘 + 설명 + "Google 계정으로 로그인" 버튼
- **로그인됨**: `✓ 연동됨: <email>` + `내 일정 N개 캘린더에서 가져옵니다` + 구독 목록 새로고침 / 연결 해제 버튼

토글 리스트, 수동 textarea, 시간 범위, 테마 섹션은 모두 제거됨.

## 관련 파일

- `src/lib/gcal-embed.ts` — config get/set, 활성 캘린더/색상/레이블 헬퍼
- `src/lib/gcal-oauth.ts` — GIS script 로더, token 발급/만료/취소
- `src/lib/gcal-api.ts` — calendarList.list, userinfo fetch
- `src/components/settings/gcal-settings.tsx` — Google 로그인 단일 카드

## 운영 메모

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 가 없으면 OAuth UI 가 안내 블록으로 자동 대체됨.
- access token 만료(기본 1시간) 후엔 사용자가 다시 로그인해야 함 — refresh token 은 implicit flow 에선 발급 안 됨. 매일 한 번 정도 재로그인 필요. 자동 갱신 원하면 server-side authorization code flow 로 마이그레이션 필요.
- 구독 캘린더 목록은 캐시 — 새 캘린더 구독했으면 "구독 목록 새로고침" 클릭.

## 미정리 영역

히스토리 페이지의 캘린더 위젯들은 아직 `mock-gcal.ts` mock 이벤트 사용 중. 풀 events.list API 전환은 별도 작업.
