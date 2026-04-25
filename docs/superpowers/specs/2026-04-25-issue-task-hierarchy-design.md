# ISSUE / TASK 계층 기능 — 설계 문서

**작성일**: 2026-04-25
**상태**: 설계 완료, 사용자 리뷰 대기
**관련 인접 문서**: `2026-04-15-wid-v2-redesign.md` (선행 v2 재설계)

---

## 1. 배경 / 동기

현재 WID는 모든 task가 평면적으로 독립이다. 노션·슬랙·수동 입력에서 들어온 task가 인박스에 한 줄씩 나열될 뿐, 서로의 관계를 표현하는 수단이 없다.

문제:
- 큰 일을 작은 task들로 쪼개고 싶을 때 표현할 방법이 없음
- 관련 task를 묶어 진행도를 보고 싶을 때 묶음이 없음
- **자잘한 sub-task가 인박스에서 묻혀 잊히는 일이 자주 발생** (사용자가 명시한 핵심 동기)

해결 방향: 부모-자식 관계를 도입하되 **독립 task와 공존**시키고, 기존 task를 손쉽게 그룹에 편입할 수 있게 하며, 드래그앤드롭으로 직관적으로 위치를 바꿀 수 있게 한다.

## 2. 핵심 개념 정의

| 개념 | 정의 | 가진 속성 |
|---|---|---|
| **ISSUE** | 가벼운 컨테이너 (큰 일 묶음) | 이름, 색상, 마감일, sort_mode, position |
| **TASK** (대문자) | 실제 작업 단위 | 기존 task의 모든 속성 + issue_id, parent_task_id, sort_mode, position |
| **sub-TASK** | TASK의 자식 (계층 한 단계 아래) | TASK와 동일한 자료형. parent_task_id로 식별 |
| **독립 TASK** | 어떤 ISSUE에도 속하지 않는 TASK | issue_id = null, parent_task_id = null |

계층: `ISSUE → TASK → sub-TASK` (총 3단계, 깊이 2). 이보다 깊은 nesting 없음.

## 3. 데이터 모델

### 3.1 새 entity: `Issue`

```ts
export interface Issue {
  id: string;
  name: string;
  color: string;                          // hex
  deadline: string | null;                // ISO date
  sort_mode: 'checklist' | 'sequential';  // 자식 TASK 정렬 모드
  position: number;                       // 인박스 내 ISSUE 정렬
  notion_issue_id: string | null;         // 노션 ISSUE 매핑
  created_at: string;
  is_deleted: boolean;
}
```

ISSUE에는 의도적으로 **status·timer·description·priority가 없다**. 가벼운 컨테이너.

### 3.2 `Task` 확장

```ts
export interface Task {
  // ... 기존 필드 (id, title, description, priority, status, source 등) 그대로

  issue_id: string | null;                // 소속 ISSUE (없으면 독립)
  parent_task_id: string | null;          // 부모 TASK (sub-TASK일 때만)
  sort_mode: 'checklist' | 'sequential';  // 자기 sub-TASK들의 정렬 모드 (parent일 때 사용)
  position: number;                       // 형제 사이 정렬 순서
}
```

### 3.3 관계 규칙 (불변식)

- `issue_id` set & `parent_task_id` null → 일반 TASK (ISSUE 안)
- `issue_id` null & `parent_task_id` set → sub-TASK (TASK 안)
- 둘 다 null → 독립 TASK
- **둘 다 set은 금지**. sub-TASK는 부모 TASK를 통해 ISSUE에 연결되며, ISSUE는 `parent.issue_id`로 조회
- `position`은 동일 부모 그룹 내에서만 정의됨 (전역 순서가 아님)

### 3.4 마이그레이션 (Supabase)

```sql
CREATE TABLE issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  deadline date,
  sort_mode text NOT NULL DEFAULT 'checklist'
    CHECK (sort_mode IN ('checklist','sequential')),
  position integer NOT NULL DEFAULT 0,
  notion_issue_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE tasks
  ADD COLUMN issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
  ADD COLUMN parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN sort_mode text NOT NULL DEFAULT 'checklist'
    CHECK (sort_mode IN ('checklist','sequential')),
  ADD COLUMN position integer NOT NULL DEFAULT 0;

-- 동시에 둘 다 set 방지
ALTER TABLE tasks ADD CONSTRAINT tasks_no_dual_parent
  CHECK (NOT (issue_id IS NOT NULL AND parent_task_id IS NOT NULL));
```

mock 데이터에도 동일한 형식으로 필드 추가.

## 4. 인박스(`/`) UI

### 4.1 핵심 원칙: 미완료만 표시

매일 보는 화면은 **"지금 안 끝난 것"만** 보인다. 완료된 항목은 ISSUE 페이지에서 회고.

표시 규칙 (재귀):
- TASK · sub-TASK는 status가 `완료`가 아니면 표시
- 완료된 TASK라도 그 자식 중 미완료가 있으면 **흐림 처리(opacity-60)** 후 표시 — 자식이 가려지지 않게
- ISSUE는 자식 중 하나라도 미완료가 있으면 표시. 모두 완료되면 인박스에서 사라짐
- 사용자가 기존 status 칩으로 "완료" 토글하면 강제 표시 ON

### 4.2 표시 구조: 2단계 펼침 / 들여쓰기

```
┌─ ▼ ●ISSUE 이름   ⏰ 4월 30일 · ⚙ 순차 · TASK 3·sub 5·진행 2/8
│   ┌─ ▼ ⬜ TASK 카드 (제목·우선순위·마감·타이머)
│   │   ├─ ⬜ sub-TASK 카드 (들여쓰기, 약간 작은 폰트)
│   │   ├─ ⬜ sub-TASK 카드
│   │   └─ + sub-TASK 추가
│   └─ ✅ TASK 카드 (완료 — 흐림. 미완 sub가 있어 노출)
│       └─ ⬜ sub-TASK 카드
│
[독립 TASK 카드]
[독립 TASK 카드]
```

- **ISSUE 행**: 펼침 토글 ▶/▼ · 색상 dot · 이름 · 마감 · 모드 뱃지 · 자식 카운트 · ⋮ 메뉴
- **TASK 행**: 기존 `TaskCard` 재사용 + 좌측에 ▶/▼ (자식이 있을 때만) + sub 카운트 뱃지
- **sub-TASK 행**: 동일 컴포넌트, padding/font-size 약간 축소 + 추가 들여쓰기

### 4.3 펼침 상태 기억

- ISSUE별: localStorage `wid:issue-collapsed:{issueId}` (boolean, 기본 펼침)
- TASK별: localStorage `wid:task-collapsed:{taskId}`
- 신규 생성 시 펼침 상태로 시작

### 4.4 검색·필터·정렬

- 기존 status·priority·source 필터: TASK·sub-TASK 모두 매치 대상. ISSUE는 status가 없으므로 제외
- 검색(`title`): ISSUE 이름·TASK 제목·sub-TASK 제목 모두 매치. 매치된 항목이 ISSUE 안에 있으면 그 ISSUE는 자동 펼침
- 정렬: ISSUE는 자체 `position`. ISSUE 내부는 `sort_mode`에 따라 `position` 또는 priority 등 기존 정렬

## 5. ISSUE 페이지(`/issues/[id]`)

### 5.1 진입 경로

ISSUE 행의 클릭 영역이 두 영역으로 분리됨:
- **펼침 토글 (▶/▼ 아이콘)**: 인박스에서 자식 표시 펼침/접힘 (페이지 이동 없음)
- **이름·메타데이터 영역**: `/issues/[id]`로 navigate

추가 진입 경로:
- 직접 URL 접근 (북마크/공유)
- TASK 우측 패널 헤더에 "이 TASK가 속한 ISSUE 보기" 링크 (issue_id가 있을 때)

TASK 클릭은 인박스·ISSUE 페이지 둘 다 우측 패널 유지 (동작 일관성).

### 5.2 와이드 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ ← 인박스   ●ISSUE 이름 [편집]   ⏰ 마감일   ⚙ 순차 ▽       │
│ 진행도 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 7/12 (58%)            │
├──────────────────────────────┬───────────────────────────┤
│ ◯ 미완료만   ◯ 전체           │ (선택된 TASK 상세)         │
│                              │                           │
│ ▼ TASK 1   [완료체크] [⋮]     │ 제목 ✏                    │
│   ├─ ✅ sub 1.1               │ 설명                       │
│   ├─ ⬜ sub 1.2 (잠금 표시)    │ 우선순위 / 마감 / 요청자   │
│   └─ + sub 추가              │ 타이머 로그                │
│ ▼ TASK 2                      │ Notion/Slack 링크         │
│ ✅ TASK 3                     │ (sub-TASK 요약 리스트)     │
│ + TASK 추가 / 기존 TASK 연결  │                           │
└──────────────────────────────┴───────────────────────────┘
```

- 좌측 트리: 인박스와 같은 카드 컴포넌트 + 드래그 정렬
- 우측 패널: 선택된 TASK의 상세 (인박스 우측 패널과 동일 컴포넌트, **폭만 더 넓음**)
- 헤더: ISSUE 이름 인라인 편집, 색상 picker, 마감일 picker, sort_mode 토글, 전체 진행도 바
- 본문 토글: "미완료만 / 전체" (인박스와 달리 기본은 사용자 선택. 처음엔 "미완료만")
- 빈 ISSUE 진입 시 가장 먼저 `+ TASK 추가` 노출

### 5.3 TASK 우측 패널 (인박스 + ISSUE 페이지 공통)

문제 의식: 기존 우측 패널이 좁다. sub-TASK 트리까지 욱여넣으면 답답.

해결:
- **폭 확대**: 기본 480px → 560px. 좌측 모서리 드래그 핸들로 사용자가 폭 조절 (localStorage 저장)
- **sub-TASK는 요약 리스트만**: 패널에서는 sub-TASK 제목·상태·완료체크 정도만 컴팩트하게. 자세한 관리는 인박스 인라인 또는 ISSUE 페이지로 유도
- 깊은 편집(긴 설명 등)은 헤더의 "전체 화면" 링크 → `/tasks/[id]` 페이지

### 5.4 책임 분담 결론

| 작업 | 어디서 |
|---|---|
| sub-TASK 빠른 추가/완료/정렬 | **인박스 인라인** |
| 한 TASK의 풍부한 편집 | **우측 패널** (좀 더 넓게) |
| 한 ISSUE 통째로 관리 (배치 작업, 회고) | **`/issues/[id]` 와이드 페이지** |

## 6. 완료 규칙

### 6.1 Hard rule: parent ↔ child

- **TASK는 모든 sub-TASK가 완료되어야만 완료 가능**
  - sub-TASK 중 하나라도 미완료면 TASK의 완료 토글 비활성
  - hover 시 툴팁: "sub-TASK 2개가 미완료입니다"
- 모든 sub-TASK가 완료된 후 → 부모 TASK는 **자동 완료 안 됨**. 사용자가 직접 토글 (사용자 통제권 보존)
- ISSUE는 별도 status 필드 없음. ISSUE의 "완료"는 모든 자식 TASK가 완료된 상태로 자동 계산

### 6.2 Soft rule: 형제 사이 (sequential 모드)

- ISSUE 또는 부모 TASK의 `sort_mode = 'sequential'`일 때만 적용
- 첫 번째 미완료 형제까지: 정상 표시
- 그 다음 미완료 형제부터: 흐림(opacity-60) + 좌측 자물쇠 아이콘 + 옅은 라벨 "이전 task 대기 중"
- **클릭·상태 변경 가능** (soft = 막지 않음). 사용자가 의도적으로 순서를 깰 수 있음
- 첫 번째 미완료가 완료되면 다음 자물쇠 자동 해제

### 6.3 의존성 데이터 모델

별도 `dependencies` 테이블 없음. `sort_mode = 'sequential'`일 때 `position` 순서가 곧 의존성.

## 7. 드래그앤드롭 / 부모 변경

### 7.1 라이브러리 선정

**`@dnd-kit/core` + `@dnd-kit/sortable`**

- React 18+ 정합성 양호, 키보드·스크린리더 지원, 적극적 유지보수
- 추가 사이즈 ~30kB
- 대안 `react-beautiful-dnd`는 유지보수 중단으로 제외

### 7.2 드래그 동작 매트릭스

| 잡는 것 | 떨어뜨리는 곳 | 결과 |
|---|---|---|
| TASK | 다른 ISSUE 헤더/내부 빈 영역 | 부모 ISSUE 변경 (reparent) |
| TASK | ISSUE 밖 빈 영역 | ISSUE에서 분리 → 독립 TASK |
| TASK | 다른 독립 TASK 위 (둘 다 issue_id=null) | 인라인 프롬프트: "둘을 새 ISSUE로 묶기?" → 이름 입력하면 ISSUE 생성 |
| TASK | 다른 ISSUE 안의 TASK 위 | 그 TASK의 ISSUE에 편입 (B의 issue_id 따름) |
| TASK | 같은 ISSUE 안 다른 위치 | `position` 변경 (형제 정렬) |
| sub-TASK | 같은 부모 내 다른 위치 | `position` 변경 |
| sub-TASK | 다른 TASK 위 (또는 그 TASK의 sub-TASK 위) | parent_task_id를 그 TASK로 변경 |
| sub-TASK | TASK 밖 (ISSUE 또는 단독 영역) | 일반 TASK로 승격 (parent_task_id = null, 떨어진 위치의 issue_id 적용) |
| ISSUE | 다른 ISSUE 위/아래 | ISSUE 자체 정렬 변경 |

호버 중 시각 피드백:
- 드롭 가능 영역에 헤일로(파란 outline) + "여기 떨어뜨리면 ~됩니다" 짧은 라벨
- 드롭 불가 영역엔 표시 없음

## 8. ISSUE 생성·관리

### 8.1 생성 경로 (둘 다 지원)

- **A. `+ 새 ISSUE` 버튼** (인박스 상단 또는 사이드바 가까이)
  - 폼: 이름, 색상(팔레트), 마감일, sort_mode (기본 checklist)
  - 빈 ISSUE 생성 → 그 안에 TASK는 별도로 추가
- **B. 드래그-병합** (인박스에서 단독 TASK A를 단독 TASK B 위로 드래그)
  - 인라인 프롬프트: ISSUE 이름만 입력 → 즉시 생성, A·B 모두 자식으로 들어감
  - 색상은 자동 (팔레트 순환), 마감일은 둘의 더 먼 날짜

### 8.2 TASK ↔ ISSUE 연결/분리

- **연결(add)**:
  - 인박스 드래그 (위 7.2 표 참조)
  - TASK 우측 패널의 ISSUE 필드에 picker 모달 — 검색 가능, 기존 ISSUE 선택 또는 즉시 새 ISSUE 생성
- **분리(unlink)**:
  - 인박스 드래그로 ISSUE 밖 빈 영역에 떨어뜨림
  - TASK 카드 ⋮ 메뉴 → "ISSUE에서 분리"
  - 우측 패널의 ISSUE 필드에서 "× 분리"
  - 분리 후: `issue_id = null`, sub-TASK는 부모 TASK 밑에 그대로 유지된 채 따라옴

### 8.3 ISSUE 삭제

매번 다이얼로그로 자식 처리 방식 확인:

```
이 ISSUE의 자식 TASK 3개를 어떻게 할까요?
◯ 독립 TASK로 분리해서 보존 (기본)
◯ 함께 휴지통으로 이동
[취소] [삭제]
```

- 자식 0개 → 단순 삭제 확인만
- 분리 선택 시: 자식 TASK들의 `issue_id`를 null로 설정. sub-TASK는 부모 TASK 따라감
- 함께 삭제 시: ISSUE + 모든 자식 TASK + 모든 sub-TASK가 휴지통으로 (`is_deleted = true`)

## 9. 노션 동기화 변경

원칙: **노션이 source of truth. 우리는 read-only.**

### 9.1 동기화 로직 변경 (`src/app/api/notion/sync/route.ts`)

기존: 노션 TASK DB → `tasks` 테이블에만 upsert.

변경:
1. 노션 TASK DB의 ISSUE relation 필드를 같이 fetch
2. 모든 TASK의 ISSUE relation에서 고유한 노션 ISSUE ID 수집
3. 각 노션 ISSUE ID에 대해:
   - 우리 DB에서 `notion_issue_id`로 조회
   - 없으면 새 ISSUE 생성 (`name` = 노션 ISSUE 제목, `color` = 팔레트 순환, `sort_mode` = checklist, `deadline` = null, `position` = max+1)
   - 있으면 `name`만 갱신 (노션이 이름 바꿨을 때 따라감). 우리 쪽에서 추가한 `color`/`deadline`/`sort_mode`/`position`은 보존
4. 각 TASK는 해당 ISSUE에 attach (`issue_id` 설정)
5. 노션 TASK에 ISSUE relation이 없으면 → 독립 TASK (`issue_id = null`)

### 9.2 Slack sync (변경 없음)

- 항상 독립 TASK 생성 (`issue_id = null`, `parent_task_id = null`)
- 사용자가 인박스에서 직접 ISSUE에 연결

### 9.3 노션 ISSUE 삭제 처리

노션에서 사라진 ISSUE는 우리 DB에서 자동 삭제하지 않음. 우리 쪽에서 그 ISSUE에 sub-TASK 등 로컬 데이터를 추가했을 수 있으므로 보존. `notion_issue_id`만 stale 상태로 유지되며 다음 sync 시 갱신되지 않음. (사용자가 수동으로 정리 가능)

### 9.4 sub-TASK는 노션에 안 올라감

노션엔 sub-task 개념 없음. 우리 앱에서 노션 TASK 안에 만든 sub-TASK는 **노션에 write 안 함**. 노션에서 보이지 않는 게 정상. 노션→우리 sync는 항상 단방향(노션→우리).

## 10. 다른 페이지 영향

| 페이지 | 영향 | 처리 |
|---|---|---|
| `/today` | 오늘 할 TASK 목록 | TASK·sub-TASK 모두 후보. 카드에 "📁 ISSUE 이름" 작은 뱃지 추가 (맥락 제공) |
| `/history` | 일별 완료 task | 그대로. 완료된 항목 카드에 ISSUE 뱃지 |
| `/calendar` | 월간 이벤트 그리드 | 그대로. ISSUE 자체엔 시간 정보 없음. TASK의 마감일만 표시 |
| 사이드바 nav | 메뉴 추가 없음 | ISSUE는 인박스의 일부 |
| 커스텀 뷰 (기존 status 필터 뷰) | TASK·sub-TASK가 매치 대상 | ISSUE 자체는 매치 안 함 (status 없음) |
| 검색(`Cmd+K`) | 제목 매치 | TASK·sub-TASK·ISSUE 이름 모두 매치 |

## 11. 단계별 구현 (phased)

각 단계는 독립적으로 사용 가능한 상태로 머지 가능 (인크리멘털).

1. **데이터·API 기반**
   - `Issue` 타입 정의 (`src/lib/types.ts`)
   - mock 데이터 확장 (`src/lib/mock-data.ts`)
   - `/api/issues` CRUD 라우트
   - `/api/tasks` 응답에 `issue_id`/`parent_task_id`/`position`/`sort_mode` 추가
   - Supabase 마이그레이션 파일 추가 (`002_issue_hierarchy.sql`)

2. **인박스 그룹 표시 (정적)**
   - ISSUE 행 컴포넌트
   - 펼침/접힘 (localStorage 기억)
   - "미완료만" 필터 규칙 (재귀)
   - sub-TASK 들여쓰기 표시
   - **드래그 없이** position 순서로만 정렬

3. **ISSUE 생성/편집/삭제**
   - `+ 새 ISSUE` 버튼 + 폼
   - ISSUE 편집 (이름·색상·마감·sort_mode 인라인)
   - 삭제 다이얼로그 (자식 처리 옵션)

4. **TASK ↔ ISSUE 링크 (picker 방식)**
   - TASK 우측 패널의 ISSUE 필드 + picker 모달
   - 기존 TASK 끌어오기 (검색 후 선택)
   - 분리(unlink) 액션 (메뉴 + 패널)

5. **`/issues/[id]` 페이지**
   - 와이드 레이아웃 (좌 트리 + 우 상세)
   - 진행도 바
   - 미완료/전체 토글
   - TASK 우측 패널 폭 확장 + 드래그 핸들

6. **완료 규칙 강제 (Hard)**
   - sub-TASK 다 완료 안 되면 TASK 완료 비활성 + 툴팁
   - 인박스·ISSUE 페이지·`/tasks/[id]` 모두에 적용

7. **드래그앤드롭** — `@dnd-kit` 도입
   - 같은 부모 내 정렬 (가장 단순)
   - ISSUE 간 reparent
   - 드래그-병합으로 ISSUE 생성
   - 분리(밖으로 빼내기)
   - sub-TASK 승격/이동

8. **순차 모드 시각화 (Soft)**
   - 자물쇠 + 흐림 + 라벨
   - 토글에 따른 즉시 시각 갱신

9. **노션 sync 확장**
   - ISSUE relation 매핑 로직
   - 신규 ISSUE 자동 생성 + 기존 매칭

10. **검색·필터 매치 보정**
    - 검색어가 sub-TASK에 매치되면 부모 TASK·ISSUE 자동 펼침
    - 기존 status·priority 필터가 sub-TASK까지 매치

11. **회귀 테스트 + 빌드 통과 + 시각 확인**
    - `npm run lint`, `npm run build` 통과
    - 인박스/오늘/히스토리 시각 회귀 확인

## 12. 검증 포인트 (구현 후)

- [ ] 빈 ISSUE 표시·삭제 정상
- [ ] sub-TASK 미완료가 있을 때 부모 TASK 완료 비활성
- [ ] sequential 모드에서 자물쇠 표시·해제 흐름
- [ ] 드래그로 reparent / unlink / merge 모두 동작
- [ ] ISSUE 삭제 다이얼로그 두 옵션 모두 정확
- [ ] 노션 sync 후 ISSUE 자동 생성·기존 ISSUE 매핑
- [ ] 검색 매치 시 부모 자동 펼침
- [ ] localStorage 펼침 상태 유지 (새로고침)
- [ ] TASK 우측 패널 폭 조절 + 저장
- [ ] 인박스 "미완료만" 규칙: 완료 TASK라도 미완료 sub가 있으면 흐림 노출

## 13. Out of scope (이번 라운드 안 함)

- 의존성 그래프 시각화 (화살표/캔버스)
- Cross-ISSUE 의존성 (다른 ISSUE 안의 TASK에 의존)
- 다인용 권한·공유 (이 앱은 1인 사용자)
- ISSUE 자체의 timer·status·priority (가벼운 컨테이너 컨셉 유지)
- TASK → 노션 write back (read-only 유지)
- 알림/리마인더
