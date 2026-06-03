# 보류함 (Pending)

## Invariant

- `tasks.pending_at` / `issues.pending_at` (timestamptz, null = 활성) — 휴지통
  `is_deleted`와 동일한 soft-flag 패턴. 두 플래그는 직교하며 `is_deleted` 우선
  (삭제된 task는 보류함에도 안 보임).
- status(등록/완료/위임/취소)와도 직교 — 보류 중에도 status 변경 가능
  (예: Notion sync가 보류된 task를 완료 처리해도 보류 유지).
- 보류 전파는 직계 children 한 단계 (3-level invariant 덕분).
  task pend → 본인 + `parent_task_id = id`.
  issue pend → issue + `issue_id = id` + `parent_task_id in (그 ids)`
  (sub-task는 issue_id가 null일 수 있어 2차 업데이트 필수).
- ISSUE는 통째로만 복귀 — 개별 task 꺼내기 불가. ISSUE 복귀 시 이전에 개별
  보류됐던 task도 같이 복귀 (보류 출처 비구분 단순화, spec 2026-06-03).
- 복귀는 position/issue_id를 건드리지 않음 → 원래 자리 복원.
- 휴지통 복구(restore)는 pending_at도 null로 — 복구는 항상 인박스로.

## 쿼리 계약

- `GET /api/tasks` 기본 = `pending_at is null` (단, `deleted=true`면 pending
  필터 미적용 — 휴지통은 보류 여부 무관하게 표시).
- `GET /api/tasks?pending=true` = 보류만. `GET /api/issues?pending=true` 동일.
- `/api/tasks/count` (사이드바 배지)도 보류 제외.
- 보류/복귀 액션: `POST /api/tasks/[id]/pend|unpend`,
  `POST /api/issues/[id]/pend|unpend` (restore/purge와 같은 POST-액션 패턴).
- 클라이언트 낙관적 제거는 서버 전파 범위와 일치해야 함 — page.tsx의
  handlePendIssue는 topIds 집합으로 issue_id null인 직계 sub까지 제거.

## 무게 인박스 (관련)

- priority 필드는 2026-06-03 전면 폐기. 시각 위계는 `src/lib/task-weight.ts`의
  `getTaskWeight(deadline, now)` 단일 기준: 지남·오늘=heavy / +7일 이내=normal /
  없음·초과=light. now는 호출부(TaskCard)가 mount 시점에 고정해 주입.
- 처리된(완료/위임/취소) task는 line-through가 우선 (호출부에서 weight=normal 고정).
- 적용 위치는 TaskCard 한 곳 (제목 클래스 + 왼쪽 키컬러 라인 + 마감 메타) —
  인박스·/today·커스텀 뷰 공용.
