# 이슈 페이지 계약 (/issues, /issues/[id])

2026-06-03 신설. ISSUE별 모아보기 — 평평한 /inbox가 잃은 "묶음 뷰"를 전담.

## 진행률 = `issueTaskProgress` 공유 헬퍼

목록과 상세가 같은 분모를 쓰도록 `src/lib/hierarchy.ts`의
`issueTaskProgress(issueId, tasks)` 하나로 집계한다. 두 페이지가 어긋나면 회귀.

- **집계 범위**: 직속(`issue_id === issueId`) + 하위(sub-TASK는 `issue_id`가
  비어 있으므로 `parent_task_id`를 따라 부모의 `issue_id`로 귀속 — `resolveIssueId`).
- **분모(`total`)**: 위 범위에서 **취소 제외**. 분자(`done`) = 완료 수(`isTaskDone`).
- **`allDone`**: 의도된 비대칭 — 취소를 **포함**해 "모두 종결"이면 true
  (취소도 더는 할 일이 아니므로). 따라서 전부 취소면 `total=0`·`pct=0`이어도
  `allDone=true`가 될 수 있다. 이 둘을 "일관성 정리"로 같은 기준에 합치지 말 것.

## /issues 목록

- 데이터: `/api/issues` + `/api/tasks?deleted=false` 한 번씩 fetch 후 클라에서 집계.
- 한 줄 = `📁 이름` + 임박 마감(있으면) + 미니 진행바 + `완료 n/m`.
- **완료된 이슈**(`allDone`) = 목록 하단 + `opacity-50`.
- 정렬: 진행 중 우선 → 마감 빠른 순 → `created_at` 최신순.

## /issues/[id] 상세

- 데이터: `/api/issues/[id]` + `/api/issues/[id]/tasks`(직속+하위 반환).
- 헤더: 이름 h1 + `n/m 완료`(`issueTaskProgress` 분모) + 큰 진행바(aria 적용).
- "다음: {position 순 첫 미완료 top-level TASK} · 마감 {date}" 한 줄 지목.
- 진행 중 목록: `buildTree`+`filterIncomplete`로 계층 유지, position 순.
  **드래그 reorder는 여기 1-context만** — 같은 ISSUE 내 top-level reorder,
  계층 변경 없음(`handleDragEnd`가 position만 PATCH). `TaskBranch`+`SortableTaskItem`
  재사용.
- `+ 이 이슈에 task 추가`: `POST /api/tasks` (issue_id=현재, parent=null,
  position=현재 top-level 최대+1).
- 완료/취소 목록: 하단 `opacity-60`.
- 행/카드 클릭 → `TaskDetailPanel`(상세 모달). 편집/삭제 → IssueForm/IssueDeleteDialog.

## 출처 브랜드 아이콘 (`SourceIcon`)

TASK 출처를 한눈에 식별하는 표시 전용 SVG(`src/components/tasks/source-icon.tsx`).
클릭 동작 없음 — 원본으로 가는 액션은 우클릭 메뉴 맨 위 "원본 열기"가 담당.

| source | 아이콘 |
|---|---|
| `slack` | 공식 4색 로고 |
| `notion` | 공식 Notion 로고 **흰색 단색**(다크 전용 — 라이트 미사용) |
| `manual`(WID 직접 입력) | 키컬러 점(`bg-primary`) |
| `jira` | 슬롯 예약 — 회색 점 placeholder(연동 범위 외) |

브랜드 컬러는 이 SVG 내부에만 존재하며 "한 화면 액센트 1개" 원칙의 의도된 예외.

## 관련 파일

- `src/app/issues/page.tsx` — 목록 집계·정렬
- `src/app/issues/[id]/page.tsx` — 상세·다음 지목·reorder·인라인 추가
- `src/lib/hierarchy.ts` — `issueTaskProgress` 공유 헬퍼
- `src/components/tasks/task-branch.tsx` — 트리 렌더 + sortable
- `src/components/tasks/source-icon.tsx` — 출처 브랜드 아이콘
