# TASK 상세 모달 개편 — 디자인 스펙

날짜: 2026-06-05
브랜치: `feat/issue-task-hierarchy`
상태: 사용자 확정 (비주얼 컴패니언 시안 v3 승인)

## 문제

현 `TaskDetailPanel`(`src/components/tasks/task-detail-panel.tsx`)의 3가지 문제:

1. **느림** — 모달을 열 때마다 ① 해당 task ② 전체 ISSUE 목록 ③ 휴지통 제외 **전체 task 목록**을 새로 fetch하고, 셋 다 도착할 때까지 스켈레톤만 보여준다. 호출하는 페이지(오늘/전체/이슈/돌아보기)는 이미 task 데이터를 들고 있는데 쓰지 않는다.
2. **ERP스러움** — Label+Input 그리드, Select, 구분선, 하단 [저장] 버튼의 전형적 입력 폼. 같은 앱의 `TaskInlineEditor`는 칩+자동 저장인데 모달만 옛 문법.
3. **위계·출처 불명** — 무엇이 TASK/ISSUE/하위 TASK인지 구분이 어렵고, 출처(슬랙/노션/JIRA) 식별이 텍스트 뱃지뿐.

## 확정된 디자인 (브레인스토밍 결정)

- **틀**: 가운데 모달 유지 (A안 — 사이드 패널 B안 기각). 현 Dialog 기반.
- **편집 모델**: 보기/수정 반반 용도 → **보이는 모든 값이 그 자리에서 수정**되는 edit-in-place. 저장 버튼 제거, `TaskInlineEditor`와 같은 blur/선택 시 자동 저장 + "저장됨" 인디케이터.
- **정보 1순위**: 관계(ISSUE·부모·하위) — 사용자 선택.

### 모달 구성 (위→아래)

1. **헤더**: `SourceIcon` 브랜드 로고(20px, 표시 전용) + 제목(클릭 시 그 자리 편집, 19px/800w). 로고가 출처를 말하므로 **"Slack에서 옴" 같은 출처 텍스트는 쓰지 않는다** (사용자 명시 결정).
2. **메타 줄**: `등록일 · 원본 열기 ↗` — 원본 링크는 `sourceOpenUrl()` 사용, 없으면(직접 입력) 등록일만.
3. **칩 줄** (클릭 → 팝오버 즉시 수정·자동 저장): 상태 ▾ / 마감일(D-n 표기) / 요청자 / ☀ 오늘 토글.
4. **소속 ISSUE 줄** (top-level TASK만): 보라 `ISSUE` 뱃지 + 📁 이름 + "이 task가 속한 묶음 · 이슈로 가기 ›". 클릭 시 `/issues/[id]` 이동. 미연결이면 "ISSUE 연결" 액션(IssuePicker). sub-TASK면 이 줄 대신 **부모 TASK 카드**(클릭 시 부모 상세로 전환)와 형제 목록 — 기존 parent/siblings 동작 유지, 새 스타일 적용.
5. **하위 TASK 구역** (top-level TASK만): 회색 `하위 TASK` 뱃지 + **"N개 중 M개 완료"** 풀어쓰기 + 진행률 바 + 하위 task 줄 목록. 각 줄 hover 시 "상세 보기 ›" — 클릭하면 모달 내용이 그 하위 task로 전환(기존 `onNavigate`). "＋ 하위 task 추가" 줄 포함(`AddSubTaskRow` 또는 동등 인라인 입력). 진행률 분모/완료 판정은 `issueTaskProgress`와 동일 규약(취소 분모 제외)을 따른다.
6. **설명**: 클릭하면 그 자리에서 Textarea 편집, blur 저장.
7. **추가 정보 (기본 접힘)**: 위임 대상 · 후속 작업 메모 · 완료일시(완료 상태일 때만).
8. **푸터**: ⏸ 보류 · 🗑 휴지통(확인 다이얼로그 유지)만 작게. 기존 보류 시 today set 제거 로직(`removeTodayTaskWithDescendants`) 유지.

### 성능 — "여는 즉시 그린다"

- 호출부가 이미 들고 있는 task 객체를 **`initialTask` prop으로 전달** → 모달은 네트워크 응답을 기다리지 않고 즉시 본문을 그린다. 스켈레톤은 initialTask가 없을 때(예: 딥링크성 진입)만.
- 관계 데이터(부모/형제/하위)·ISSUE 목록은 **백그라운드에서 채운다** — 도착 전까지 해당 구역만 가벼운 placeholder, 본문은 멀쩡히 보임.
- **전체 task 목록 fetch(`/api/tasks?deleted=false`) 제거.** 호출부가 이미 가진 task 배열을 `tasks` prop으로 넘기면 관계를 로컬 계산, 없으면 그때만 fetch (점진적: 1차는 prop 전달이 안 되는 페이지만 fetch 유지 가능).
- 신선도: 백그라운드로 해당 task 1건을 재검증(fetch)해 stale하면 조용히 갱신.

### 디자인 토큰·원칙 준수

- 다크 기준(`#161621` 바탕, 카드 `#1f1f2b`급 표면 토큰), 키컬러 `#7D74F8` 단일 액센트. 새 색 없음 — 기존 토큰만.
- 브랜드 로고는 "한 화면 액센트 1개" 원칙의 기존 예외(`SourceIcon`) 재사용 — 표시 전용, 클릭 동작 없음(열기는 메타 줄 링크가 담당).
- Pretendard weight×tracking 위계, `tabular-nums` 숫자.

## 구현 윤곽

- `task-detail-panel.tsx`를 **그 자리에서 재작성** (파일·컴포넌트명 유지, props 하위호환 + `initialTask?: Task`, `tasks?: Task[]` 추가).
- 재사용: `SourceIcon`/`sourceOpenUrl`, `TaskChipButton`, `DeadlinePopover`, `IssuePicker`, `ConfirmDialog`, `AddSubTaskRow`, `TaskInlineEditor`의 저장 라이프사이클 패턴(저장 중/저장됨, `task-updated` 이벤트 dispatch).
- 호출부 4곳(`/today`, `/inbox`, `/issues/[id]`, `/history`)에서 `initialTask`(+가능하면 `tasks`) 전달.
- 노션発 task 제목 수정 시 `name_locked` 잠금 패치 유지.
- 기존 계약 유지: depth guard, sub-TASK는 부모 경유 ISSUE 연결(직접 연결 UI 없음), 상태 3-값 모델.

## 검증 기준

- 리스트에서 카드 클릭 → 모달 본문이 **즉시**(네트워크 대기 없이) 보인다.
- 출처별(슬랙/노션/JIRA/직접) 로고가 제목 옆에 보이고, 출처 텍스트는 없다.
- ISSUE 줄·하위 TASK 구역이 뱃지로 구분되고, "N개 중 M개 완료"가 보인다.
- 모든 필드가 저장 버튼 없이 그 자리에서 수정·자동 저장된다.
- 하위 task "상세 보기 ›" → 모달 전환, sub-TASK에서 부모 카드로 복귀 가능.
- `npm run build` exit 0, lint 신규 문제 0.
