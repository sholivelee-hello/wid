# WID — 다음 세션 가이드

**마지막 작업일:** 2026-04-16
**현재 상태:** v2 구현 완료, git 초기 커밋 완료 (`a33ce28`)

---

## 현재 앱 상태 요약

WID는 개인 업무 task 인박스 앱. 노션/슬랙/수동 입력으로 들어오는 task를 한 곳에서 처리하는 것이 목적.

### 구조
- `/` — **인박스** (처리필요 / 오늘완료 / 위임취소 그룹)
- `/today` — **오늘** (시각적 타임라인 + 오늘 할 task)
- `/history` — **히스토리** (월 달력 + 검색, 주별/월별 대체)
- `/settings` — 설정 (상태관리, Notion, Slack, Google Calendar)
- 사이드바 하단: **캘린더 구독 패널** (5명, 체크/색상 토글)

### 기술 스택
- Next.js 16+, shadcn/ui v4 (base-ui), Tailwind CSS v4
- Supabase (미연결 — mock 데이터로 동작 중)
- Google Calendar (미연결 — mock 데이터)
- Zustand (타이머 상태), localStorage (캘린더 가시성, 숨긴 상태)

### 주요 파일
- **Spec:** `docs/superpowers/specs/2026-04-15-wid-v2-redesign.md`
- **Plan:** `docs/superpowers/plans/2026-04-15-wid-v2-implementation.md`
- **DB 스키마:** `supabase/migrations/001_initial_schema.sql`
- **Mock 데이터:** `src/lib/mock-data.ts`, `src/lib/mock-gcal.ts`, `src/lib/mock-calendars.ts`

---

## 다음 세션에서 해야 할 일 (우선순위순)

### 1순위: 브라우저 테스트 + 피드백 반영

```bash
cd C:\Users\MIR-NOT-DXD-003\Desktop\WID
npm run dev
# → http://localhost:3000
```

**확인할 것:**
- [ ] 인박스 (`/`): task 카드 레이아웃, 인라인 상태변경, 완료 토글, 정렬, 검색
- [ ] 오늘 (`/today`): 시각적 타임라인이 제대로 렌더링되는지, 일정 블록 위치/크기
- [ ] 히스토리 (`/history`): 달력 날짜 클릭 → 오른쪽 상세, 검색 → 결과 표시, 완료 뱃지
- [ ] 캘린더 체크박스: 체크 해제 → 오늘/히스토리에서 해당 캘린더 일정 숨김
- [ ] 캘린더 색상 변경: dot 클릭 → 팔레트 → 일정 색상 즉시 반영
- [ ] 사이드바 접기/펼치기, 모바일 메뉴 (브라우저 폭 줄여서 확인)
- [ ] 다크모드 (헤더 해/달 아이콘)
- [ ] 키보드 단축키: Cmd+N (새 task 모달), Cmd+K (검색 포커스)
- [ ] `/weekly`, `/monthly` 접속 시 `/history`로 리다이렉트 되는지

**피드백이 나오면:** 즉시 수정 루프를 돌려야 함. 사용자가 "이게 이상해" 하면 바로 고쳐야 함.

### 2순위: UI/UX 폴리시

새로 만든 페이지들(히스토리, 오늘 타임라인)은 아직 디자인 정제가 부족할 수 있음.

**확인 포인트:**
- 히스토리 2열 레이아웃 — 달력과 상세 패널 비율이 적절한지
- 오늘 타임라인 — 이벤트 블록 간격, 텍스트 잘림, 빈 시간대 표시
- 인박스 task 카드 — 메타 정보(우선순위/마감/요청자) 가독성
- 전반적인 색상/간격/타이포 일관성

필요하면 **ui-ux-pro-max 스킬 + evaluator 루프**로 다시 돌릴 수 있음.

### 3순위: 실제 서비스 연동

#### Supabase 연결
1. Supabase 프로젝트 생성 (https://supabase.com)
2. SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 실행
3. `.env.local` 수정:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-key
   ```
4. 앱 재시작 → mock 데이터 대신 실제 DB 사용 (자동 전환)

#### Google Calendar OAuth
- 현재: mock 캘린더 5명 + mock 이벤트 11개
- 실제 연동 시: Google Cloud Console → OAuth 2.0 설정 → Calendar API 활성화
- `/api/gcal/calendars` + `/api/gcal/events` 라우트를 실제 API 호출로 교체
- 이건 별도 세션에서 집중적으로 할 것을 추천

#### Slack 웹훅 연결
1. Slack App 생성 (https://api.slack.com/apps)
2. Event Subscriptions → Request URL: `https://your-domain/api/slack/webhook`
3. Subscribe to bot events: `reaction_added`
4. `.env.local`에 `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` 입력
5. 트리거 이모지: `:eyes:` → task 생성
6. 완료 이모지: `:white_check_mark:` → task 완료 처리

### 4순위: GitHub + 배포

```bash
# GitHub 레포 생성 후
git remote add origin https://github.com/username/wid.git
git push -u origin master

# Vercel 배포
# vercel.com에서 GitHub 레포 연결 → 자동 배포
# 환경변수 설정 필요 (Supabase, Notion, Slack 키)
```

---

## 알려진 미해결 사항

spec의 "Known Follow-ups" 섹션에 기록된 항목들:

1. **Error-handling UI** — API 실패 시 retry 버튼/fallback 메시지 (현재는 toast만)
2. **모바일 히스토리 레이아웃** — 좁은 화면에서 달력 셀 압축 처리
3. **`/api/stats/*` 정리** — 사용하지 않는 기존 stats API 라우트 삭제
4. **타임라인 이벤트 겹침** — 같은 시간대 이벤트 side-by-side 렌더링
5. **DashboardSkeleton** — 사용처 없으면 삭제

---

## 사용자 선호 메모

- "일감" → **"task"** 라고 부름 (전부 교체 완료)
- 총 소요시간 같은 집계 통계 **불필요** — 각 task별 시간만 중요
- 주별/월별은 **가끔 과거 조회용** (통계 아님, 날짜+키워드 검색)
- Google Calendar 구독 = **뷰 가시성 토글만** (실제 구독 관리는 Google에서)
- 디자인: **Linear/Height 스타일** 선호 (모노크롬 + 1 accent, 미니멀)
- 쨍한 색/MVP 느낌 **싫어함**
