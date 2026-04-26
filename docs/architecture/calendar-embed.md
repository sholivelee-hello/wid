# Google Calendar embed (multi-cal + hour-crop + dark filter)

기존 커스텀 WeekView 제거. OAuth 없이 공개 임베드 URL만 사용.

## 설정 스키마 (`localStorage[wid-gcal-config]`)

```ts
interface GCalConfig {
  calendars: string[];                        // calendar ID 또는 임베드 URL (한 줄에 하나)
  startHour: number;                          // 0–23, 기본 7
  endHour: number;                            // 1–24, 기본 21
  darkMode: 'auto' | 'light' | 'dark';        // auto = next-themes 따라감
}
```

레거시 키 `wid-gcal-embed` (단일 string) 자동 마이그레이션됨 (`getGCalConfig` 안에서).

## URL 빌드: `buildEmbedUrl(config, { mode, bgColor })`

- `src=` 파라미터를 calendar ID마다 하나씩 (멀티 캘린더 임베드)
- `mode=WEEK | MONTH | AGENDA`
- `ctz=` 사용자 timezone
- 크롬 숨김: `showTitle=0`, `showPrint=0`, `showCalendars=0`, `showTabs=0`, `showTz=0`
- 입력값 분해 (`expandCalendarIds`):
  - email 형태 (`x@y`) → 그대로
  - `https://calendar.google.com/calendar/embed?...` URL → 안에서 모든 `src=` 추출

## Hour crop (WEEK 모드 전용)

Google WEEK 임베드는 24시간을 vertical grid로 그림. 일부만 보이게 잘라냄:

```tsx
const PX_PER_HOUR = 60;  // calendar/page.tsx 상수
const visibleHours = config.endHour - config.startHour;
const wrapperHeight = visibleHours * PX_PER_HOUR;
const iframeHeight = 24 * PX_PER_HOUR;
const iframeMarginTop = -config.startHour * PX_PER_HOUR;

<div style={{ height: wrapperHeight, overflow: 'hidden' }}>
  <iframe height={iframeHeight} style={{ marginTop: iframeMarginTop }} ... />
</div>
```

MONTH / AGENDA 모드는 crop 우회 (`cropEnabled = false`).

`PX_PER_HOUR` 는 Google 내부 레이아웃에 의존하는 튜닝 값. Google이 격자 비율 바꾸면 조정 필요.

## 다크 모드

조건: `darkMode === 'dark'` OR (`darkMode === 'auto' && resolvedTheme === 'dark'`).

iframe에 CSS 필터 적용:
```ts
filter: 'invert(0.92) hue-rotate(180deg)'
```
공식 다크 임베드가 없어서 색 반전 hack. 일부 색 어색하게 보일 수 있다는 안내 문구를 UI에 표시.

## 관련 파일

- `src/lib/gcal-embed.ts` — config get/set, expandCalendarIds, buildEmbedUrl, 레거시 마이그레이션
- `src/components/settings/gcal-settings.tsx` — textarea 입력, 시작/종료 시간, 테마 선택
- `src/app/calendar/page.tsx` — iframe + crop wrapper + dark filter + WEEK/MONTH/AGENDA 토글

## 미정리 영역

대시보드/히스토리의 캘린더 위젯들은 아직 `mock-gcal.ts` mock 이벤트 사용 중. 풀 임베드 전환은 별도 작업.
