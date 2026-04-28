# CLAUDE.md — WID 프로젝트 컨텍스트

이 파일은 Claude Code가 이 레포에서 작업할 때 참조하는 프로젝트 컨텍스트입니다. 사용자 개인의 토이 프로젝트(개인 업무 인박스/타임라인 앱)이며, 회사와 무관합니다.

---

## 프로젝트 개요

- **이름**: WID (work inbox / dashboard)
- **목적**: 개인이 노션·슬랙·수동 입력으로 들어오는 일들을 한 인박스에서 처리하고, 시각적 타임라인과 히스토리로 회고하는 앱
- **범위**: 1인 사용자(personal use). 다인용·SaaS 아님
- **단계**: v2 구현 완료(`a33ce28` → 개인 메일 author 재작성으로 `ec6dafe`). 이후 인박스 UX 대수술(드래그 reorder, 인라인 에디터, 계층 표시, GCal 임베드, today prompt-next) + **디자인 시스템 v3** 마감 — `feat/issue-task-hierarchy` 브랜치
- **상세 컨텍스트**: `docs/NEXT-SESSION.md`, `docs/architecture/` (도메인별 invariant·계약·패턴), `docs/superpowers/specs/`, `docs/superpowers/plans/`

## 기술 스택

- **프론트/백**: Next.js 16+ App Router, TypeScript, Tailwind CSS v4
- **UI**: shadcn/ui v4 (base-ui 기반)
- **상태관리**: Zustand (타이머), localStorage (캘린더 가시성, 사용자 뷰 등)
- **데이터**: Supabase 미연결 — 현재 mock 데이터로 동작 중 (`src/lib/mock-data.ts`, `src/lib/mock-gcal.ts`, `src/lib/mock-calendars.ts`). Supabase 마이그레이션은 `supabase/migrations/`에 정의됨
- **외부 연동**: Notion (TASK DB sync), Slack (webhook), Google Calendar — 모두 mock 또는 부분 연동
- **개발 명령어**: `npm run dev` (Turbopack), `npm run build`, `npm run lint`

## 디자인 시스템 v3 (현재 기준선)

토스/카카오뱅크의 "단일 강조 + 비워둔다" 원칙. 향후 작업은 이 기준선을 깎지 말고 다듬는 방향으로.

- **타이포**: Pretendard Variable single-system (self-host, `public/fonts/PretendardVariable.woff2`). serif 디스플레이 폐기. 위계는 **weight × tracking**으로만 — h1 800w `-0.04em` `lh 1.02`, h2 700w `-0.03em`, body 400~500w `-0.01em`, 숫자는 `tabular-nums`. 토큰: `--font-sans`, `--font-heading`, `--font-display` 모두 Pretendard.
- **컬러**: 단일 키컬러 `#7D74F8` (oklch light `0.63 0.191 282.6` / dark `0.73 0.17 282`). 한 화면 액센트 1개 원칙 — amber/emerald/mustard 잔재 없음. `destructive`(빨강)만 의미적 예외. chart-2~5는 chroma 0.04~0.06 무채색.
- **표면**: 그림자 거의 0. border + `bg-card` / `bg-muted/40`로 위계. `card-hover-lift`는 bg 전환만, transform 없음.
- **레이아웃**: 페이지 hero h1 안 씀. `/`는 인라인 한 줄 요약, `/today`는 미세 progress bar 한 줄, `/history`는 월 네비게이터만. 큰 숫자는 그 페이지의 단 하나의 핵심 지표에만.
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
- **세션 인계**: `docs/NEXT-SESSION.md` (다음 세션 가이드 — 새 세션 시작 시 가장 먼저 읽기)
- 큰 변경은 spec → plan → 구현 순서. 구현 도중 결정이 바뀌면 spec/plan을 함께 업데이트

## 아키텍처 참조 문서

도메인별 invariant·계약·구현 패턴은 `docs/architecture/` 에 분리. CLAUDE.md는 인덱스만, 실제 내용은 아래 각 문서 참조.

| 문서 | 다루는 것 |
|---|---|
| `docs/architecture/hierarchy.md` | ISSUE > TASK > sub-TASK 3-level invariant. depth guard 위치 (POST/PATCH/UI), normalizeDepth 자가치유, hierarchyLabel 데이터 기준 계산. |
| `docs/architecture/today.md` | explicit/effective today set 의 두 모델, today forest 빌드, prompt-next-on-complete 토스트 발동 조건. |
| `docs/architecture/dnd.md` | `@dnd-kit` ID 네임스페이스 (`iss:`, `dropiss:`, `tsk:`, `unlinked`), 4-context sortable, grip handle 패턴, KeyboardSensor 와이어링. |
| `docs/architecture/inline-editing.md` | TaskCard 클릭 시맨틱 (카드=에디터 / chevron=expand / grip=drag), TaskInlineEditor save 라이프사이클 (저장 중 / 저장됨 / 토스트). |
| `docs/architecture/calendar-embed.md` | `GCalConfig` (oauth + subscribedCalendars), GIS implicit-flow OAuth, 활성 캘린더/색상 헬퍼. /calendar 페이지 제거되어 히스토리에 통합. |
| `docs/architecture/mock-backend.md` | `__tasksRef` / `__issuesRef` 컨벤션, **POST는 반드시 push** 규칙, position 할당 룰, PATCH 가드 코드 카탈로그. |

새로운 아키텍처 결정이나 invariant이 생기면 위 문서 중 하나에 추가하거나 새 파일 만들고 이 표에 한 줄로 색인.

## 보안·프라이버시 주의사항

- **회사 식별 정보 금지**: 코드·커밋 메시지·문서·로그 어디에도 회사 메일(`shlee@mirapartners.co.kr`), 회사명, 회사 시스템 식별자를 넣지 마세요
- **개인정보**: mock 데이터에 등장하는 이름·요청자는 의도된 더미 데이터(가상의 동료 이름)
- **API 키**: `.env.local` 사용. `.env*` 파일은 .gitignore로 제외됨. 절대 commit 금지
