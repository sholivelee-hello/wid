# CLAUDE.md — WID 프로젝트 컨텍스트

이 파일은 Claude Code가 이 레포에서 작업할 때 참조하는 프로젝트 컨텍스트입니다. 사용자 개인의 토이 프로젝트(개인 업무 인박스/타임라인 앱)이며, 회사와 무관합니다.

---

## 프로젝트 개요

- **이름**: WID (work inbox / dashboard)
- **목적**: 개인이 노션·슬랙·수동 입력으로 들어오는 일들을 한 인박스에서 처리하고, 시각적 타임라인과 히스토리로 회고하는 앱
- **범위**: 1인 사용자(personal use). 다인용·SaaS 아님
- **단계**: v2 구현 완료(`a33ce28` → 개인 메일 author 재작성으로 `ec6dafe`). 이후 인박스 UX 대수술(인라인 에디터, 계층 표시, GCal 임베드, today prompt-next) + **디자인 시스템 v3** 마감. 2026-06-03: IA 단순화 + **/inbox 평면 리스트** 전환(드래그 reorder는 이슈 상세로 이동) + **이슈 페이지 신설**(/issues 목록·상세, 묶음 뷰 전담) + **노션 name_locked**(이름 보호) — `feat/issue-task-hierarchy` 브랜치
- **상세 컨텍스트**: `docs/architecture/` (도메인별 invariant·계약·패턴), `docs/superpowers/specs/`, `docs/superpowers/plans/`

## 기술 스택

- **프론트/백**: Next.js 16+ App Router, TypeScript, Tailwind CSS v4
- **UI**: shadcn/ui v4 (base-ui 기반)
- **상태관리**: Zustand (타이머), localStorage (캘린더 가시성, 사용자 뷰 등)
- **데이터**: Supabase 실연결 완료 (2026-04-29). mock 파일 전부 삭제됨. 마이그레이션: `supabase/migrations/001_initial_schema.sql` + `002_hierarchy_and_issues.sql`
- **외부 연동**: Slack 실연동 완료 (reaction_added → task 생성). Notion (2개 DB 동기화 — env `NOTION_DATABASE_ID_1`/`_2`, name_locked 이름 보호, title 조각 전체 join — 첫 조각만 읽으면 긴 이름 잘림). JIRA 웹훅 실연동 (알림 5종 → task, `/api/jira/webhook?token=` — `docs/architecture/jira.md`). Google Calendar — 서버 OAuth(Authorization Code flow, refresh_token 서버 보관)로 한 번 로그인하면 자동 유지 (env `GOOGLE_CLIENT_SECRET` 필요 — `docs/architecture/calendar-embed.md`)
- **개발 명령어**: `npm run dev` (Turbopack), `npm run build`, `npm run lint`
- **Slack 로컬 개발**: cloudflared로 터널 열어야 Slack webhook이 도달함. `cloudflared tunnel --url http://localhost:3000` 실행 후 나오는 `https://xxx.trycloudflare.com` URL을 Slack App → Event Subscriptions → Request URL에 등록. 터널 재시작하면 URL이 바뀌므로 그때마다 재등록 필요. 봇이 이모지 달린 채널에 멤버로 들어가있어야 reaction_added 이벤트를 받을 수 있음 (`/invite @TASK줍줍봇`). 봇 토큰에 `users:read` 스코프 필요(요청자 이름 해석 — `users.info` 캐시).

## 디자인 시스템 v3 (현재 기준선)

토스/카카오뱅크의 "단일 강조 + 비워둔다" 원칙. 향후 작업은 이 기준선을 깎지 말고 다듬는 방향으로.

- **타이포**: Pretendard Variable single-system (self-host, `public/fonts/PretendardVariable.woff2`). serif 디스플레이 폐기. 위계는 **weight × tracking**으로만 — h1 800w `-0.04em` `lh 1.02`, h2 700w `-0.03em`, body 400~500w `-0.01em`, 숫자는 `tabular-nums`. 토큰: `--font-sans`, `--font-heading`, `--font-display` 모두 Pretendard.
- **컬러**: 단일 키컬러 `#7D74F8` (oklch light `0.63 0.191 282.6` / dark `0.73 0.17 282`). 한 화면 액센트 1개 원칙 — amber/emerald/mustard 잔재 없음. `destructive`(빨강)만 의미적 예외. chart-2~5는 chroma 0.04~0.06 무채색. **다크 배경 = `#161621`** (2026-06-05 사용자 결정 — 기존 0.155보다 한 단계 밝고 보라끼 있는 네이비, ≈oklch 0.206 0.022 285). 표면 위계는 bg 기준 동반 상승(card 0.25 / popover 0.26 / muted 0.29 / sidebar 0.196), 텍스트는 fg 0.97 / muted-fg 0.82로 상향(0.74도 어둡다는 피드백으로 재상향 2026-06-05). manifest splash도 `#161621`.
- **출처 브랜드 아이콘 예외** (2026-06-03): TASK 출처 식별용 브랜드 아이콘(슬랙 4색 로고, 노션 흰색 단색 N, WID 직접입력 키컬러 점, jira 공식 로고 #2684FF 단색)은 "한 화면 액센트 1개" 원칙의 의도된 예외다. 브랜드 컬러는 `SourceIcon`(`src/components/tasks/source-icon.tsx`) SVG 내부에만, 표시 전용(클릭 동작 없음 — 원본 열기는 우클릭 메뉴 맨 위). 상세 → `docs/architecture/issues.md`.
- **표면**: 그림자 거의 0. border + `bg-card` / `bg-muted/40`로 위계. `card-hover-lift`는 bg 전환만, transform 없음.
- **레이아웃**: 페이지 hero h1 안 씀. 콘텐츠 컬럼은 `max-width 860px` 중앙 정렬(`ContentColumn` client 래퍼가 경로별 결정) — 오늘/전체/이슈 공통, **돌아보기(/history)는 전폭 예외**(캘린더+패널 2단 레이아웃). 시작 화면은 `/today`(루트 `/`는 redirect). `/today`는 미세 progress bar 한 줄, `/inbox`(전체)는 상단 보기 칩(진행 중·보류·완료·휴지통) + 인라인 한 줄 요약 + 기본 접힘 도구바 + **평면 리스트**(2026-06-04: grip 드래그 수동 정렬 부활 + 오늘로 보낸 task 숨김 — `docs/architecture/hierarchy.md`), `/issues`는 묶음 뷰(목록·상세), `/history`(돌아보기)는 월 네비게이터만. `/today`는 그룹·개별 TASK 모두 grip 드래그 reorder(`docs/architecture/today.md`). 사이드바는 메뉴 4개(오늘·전체·이슈·돌아보기, 이슈 아이콘 lucide `Folder`) + 하단 설정 톱니바퀴. 큰 숫자는 그 페이지의 단 하나의 핵심 지표에만.
- **사이드바 = 무채색 면 + 로고 dot** (2026-06-03 갱신, 보라 기둥 폐기): 사용자 결정 — 앱을 100% 다크모드로 사용하며 보라 통판 사이드바가 "옛날 ERP 느낌"이라 폐기. 사이드바는 본문과 거의 같은 어두운 무채색 표면(`bg-sidebar`) + 오른쪽 `border-sidebar-border` hairline으로만 본문과 구분(그림자 0). 브랜드 식별("미션 컨트롤에서 창 구분")은 통판이 아니라 로고 옆 **키컬러 dot 한 점**(`bg-primary`)이 담당. 위계: 활성 = `bg-sidebar-accent` pill + 흰 글자 + **3px 키컬러 레일** + 키컬러 아이콘, 비활성 = `text-muted-foreground` + hover 시 `bg-sidebar-accent/60`. 컬러는 "현재 위치"를 가리키는 레일/아이콘에만 최소량. 카운트 뱃지 = `bg-primary/15 text-primary`. 모바일 헤더 Sheet nav도 동일 언어. 모든 색은 기존 토큰(`--sidebar*`, `primary`, `muted`, `border`)만 사용 — 새 색 없음, 라이트는 토큰으로 자동 따라옴.
- **다크 전용** (2026-06-03): 사용자는 100% 다크모드로 사용 — `layout.tsx` ThemeProvider `forcedTheme="dark"`로 라이트 전환 경로 자체를 제거(헤더 테마 토글 삭제). 라이트 토큰은 globals.css에 남아 있으나 도달 불가(dead). 디자인 평가·수정은 다크 기준.
- **미션 컨트롤 창 식별 = "WID" 제목 + 키컬러 워드마크 + theme-color** (2026-06-03 개정): 창 제목은 군더더기 없이 `"WID"`만 — 🟣 마커와 "What I Do" 꼬리표는 사용자 결정으로 제거. 3px top bar는 "브라우저와 분리돼 보인다"는 피드백으로 같은 날 폐기. 대신 사이드바 좌상단 **"WID" 워드마크 자체를 `text-primary`(키컬러)로** — 화면 콘텐츠에 자연스럽게 통합된 식별 앵커로, 어두운 썸네일에서 좌상단 보라 글자로 창을 구분한다. `viewport.themeColor`는 단일 `#7D74F8`(설치형 웹앱 타이틀바 틴트). 새 색 없음.
- **참고**: 디자인 결정 변경 시 이 섹션을 같이 갱신. 단순 색·자간 미세조정은 갱신 불필요.

## 인프라 / 계정 정보

이 프로젝트는 **개인 작업물**이며, 회사 자원과 완전히 분리되어 있습니다. Claude는 작업 시 회사 메일·계정·인프라를 절대 참조하지 마세요.

### Git identity (자동 분기 적용됨)

`~/.gitconfig`의 `includeIf "gitdir:~/Desktop/Project/TOY/"` 설정으로 이 디렉토리 하위 모든 레포는 자동으로 개인 메일이 적용됩니다.

- **이 레포에서의 author**: `이신희 <sholivelee@gmail.com>`
- **글로벌 기본값(다른 디렉토리)**: 회사 메일이 박혀 있으니 절대 이 레포에 노출시키지 마세요
- 새 커밋 만들 때 `git config user.email` 항상 `sholivelee@gmail.com`인지 확인 가능

### 원격 저장소

- **개인 GitHub**: https://github.com/sholivelee-hello/wid
- 회사 GitHub Enterprise나 회사 조직 어디에도 없음
- Push는 macOS 키체인의 개인 PAT로 인증 (sholivelee-hello 계정, user id 277253829)
- 회사 GitHub 조직에는 절대 push/fork/이동하지 마세요

### 디바이스

- 사용자 본인 소유 Mac. MDM·EDR·DLP 없음. 회사 감시 SW 없음

## 코드 작성 규칙 (이 프로젝트 한정)

- **Mock-first**: Supabase 연결 전이므로, 신규 API/store는 mock을 우선 채워두고 실제 연동은 별도 단계로
- **Korean UI**: 사용자 인터페이스 문구는 한국어 (변수/함수명·주석은 영어)
- **개인 사용**: 다인용 권한·인증 로직 추가하지 말 것 (단일 사용자 가정)
- **shadcn/ui 우선**: 새 UI 컴포넌트는 shadcn 기존 컴포넌트 재사용 → 확장 → 신규 순서로 검토
- **새 라이브러리 추가 시**: 기존 의존성으로 해결 가능한지 먼저 확인. 추가 시 README/이 파일에 반영

## 작업 흐름

- **계획 문서**: `docs/superpowers/specs/YYYY-MM-DD-<주제>-design.md` (브레인스토밍 결과)
- **구현 플랜**: `docs/superpowers/plans/YYYY-MM-DD-<주제>-implementation.md`
- 큰 변경은 spec → plan → 구현 순서. 구현 도중 결정이 바뀌면 spec/plan을 함께 업데이트

## 배포 프로세스 (필수 — 사용자 지시 2026-06-03)

prod 배포 전 **반드시** 아래 순서를 지킨다. 어느 단계도 건너뛰고 배포하지 말 것:

1. **전부 커밋** — `git status` clean 확인 (의도적으로 남기는 파일 제외)
2. **GitHub 푸시** — origin(개인 저장소)에 브랜치 푸시. prod 반영분은 master 병합 후 master 푸시
3. **빌드 검증** — `npm run build` exit 0 + `npm run lint` 신규 문제 0 확인
4. **그 다음에만 배포** — Vercel prod (Git 연동이면 master push가 트리거, 아니면 `vercel --prod`)
5. 배포 후 prod URL 동작 확인 (주요 라우트 200)

DB 마이그레이션이 포함된 배포는 마이그레이션을 **먼저** Supabase에 적용한 뒤 코드를 배포한다 (컬럼 없는 코드가 prod에 뜨는 순간 방지).

## 아키텍처 참조 문서

도메인별 invariant·계약·구현 패턴은 `docs/architecture/` 에 분리. CLAUDE.md는 인덱스만, 실제 내용은 아래 각 문서 참조.

| 문서 | 다루는 것 |
|---|---|
| `docs/architecture/status.md` | task 상태 3-값 모델(등록/완료/취소), isTaskDone 종결 기준, 위임=delegate_to 필드(status 아님) 결정, /inbox 칩 용어 일치, 취소 표시 위치, status CHECK·마이그레이션 이력. |
| `docs/architecture/hierarchy.md` | ISSUE > TASK > sub-TASK 3-level invariant. depth guard 위치 (POST/PATCH/UI), normalizeDepth 자가치유, hierarchyLabel 데이터 기준 계산. /inbox 평면 리스트 표시·정렬·그룹 정책. |
| `docs/architecture/issues.md` | /issues 목록·상세 계약. 진행률 집계(`issueTaskProgress` 공유 헬퍼 — 취소 분모 제외·allDone은 취소 포함 종결), 다음 지목, 이슈 상세 1-context 드래그, 출처 브랜드 아이콘. |
| `docs/architecture/today.md` | explicit/effective today set 의 두 모델, today forest 빌드, prompt-next-on-complete 토스트 발동 조건. |
| `docs/architecture/dnd.md` | `@dnd-kit` ID 네임스페이스 (`iss:`, `dropiss:`, `tsk:`, `unlinked`), 4-context sortable, grip handle 패턴, KeyboardSensor 와이어링. |
| `docs/architecture/inline-editing.md` | TaskCard 클릭 시맨틱 (카드=에디터 / chevron=expand / grip=drag), TaskInlineEditor save 라이프사이클 (저장 중 / 저장됨 / 토스트). |
| `docs/architecture/calendar-embed.md` | `GCalConfig` (oauth + subscribedCalendars), 서버 OAuth(code flow + refresh_token 자동 갱신, `ensureFreshOAuth()` 계약), 활성 캘린더/색상 헬퍼. /calendar 페이지 제거되어 히스토리에 통합. |
| `docs/architecture/mock-backend.md` | `__tasksRef` / `__issuesRef` 컨벤션, **POST는 반드시 push** 규칙, position 할당 룰, PATCH 가드 코드 카탈로그. |
| `docs/architecture/pending.md` | 보류함 pending_at soft-flag invariant, pend/unpend 전파 규칙, 무게 인박스(getTaskWeight) 기준. |
| `docs/architecture/jira.md` | JIRA 웹훅 연동 — 알림 5종(할당·멘션·내 이슈 댓글·내 이슈 상태 변경·내가 담당하는 묶음 하위 상태 변경)→TASK 매핑, token 인증, jira_events dedup, 댓글 body wiki/ADF 처리, EPIC 하위 판정(isMyEpicChild + JIRA_EMAIL/JIRA_API_TOKEN), JIRA 쪽 웹훅 등록 절차. |
| `docs/architecture/realtime.md` | 웹훅/sync→열린 화면 자동 갱신. Supabase Realtime Broadcast 채널 `wid-tasks`(데이터 미포함, 신호만), 송신 3곳(`broadcastTasksChanged`), 수신 bridge→`task-created` 이벤트, RLS 전제(anon 전면 차단·broadcast만 공개), service role 전환 보안 결정. |

새로운 아키텍처 결정이나 invariant이 생기면 위 문서 중 하나에 추가하거나 새 파일 만들고 이 표에 한 줄로 색인.

## 보안·프라이버시 주의사항

- **회사 식별 정보 금지**: 코드·커밋 메시지·문서·로그 어디에도 회사 메일(`shlee@mirapartners.co.kr`), 회사명, 회사 시스템 식별자를 넣지 마세요
- **개인정보**: mock 데이터에 등장하는 이름·요청자는 의도된 더미 데이터(가상의 동료 이름)
- **API 키**: `.env.local` 사용. `.env*` 파일은 .gitignore로 제외됨. 절대 commit 금지
