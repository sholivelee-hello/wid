# 다음 세션: AI 제목 정리 기능 (2026-06-05 합의)

> 이 파일은 다음 Claude Code 세션이 바로 작업을 시작할 수 있게 남기는 인수인계 메모.
> 구현 완료 후 이 파일은 삭제한다.

## 무엇을 만들기로 했나

슬랙·JIRA에서 들어온 TASK의 제목을 **AI가 "~하기" 할일형으로 자동 정리**한다.
예: 장문 슬랙 메시지 → "정산 화면 QA 피드백 12~18번 반영하기"

## 핵심 결정 (사용자 확정)

1. **Anthropic API 키 안 씀** — 사용자가 API 결제 원치 않음. Claude Code **구독**으로 해결.
2. **2단계 구조**:
   - **① 웹훅 보강 (선행 필수)**: 슬랙/JIRA 웹훅이 task 생성 시 **원문 전체를 description에 저장**.
     현재 제목을 200자에서 자르고 나머지를 **버리고 있음** — 이걸 안 고치면 AI가 읽을 원문이 없다.
     - 자르는 위치: `src/app/api/slack/webhook/route.ts:142, 243` (`resolvedText.slice(0, 200)`)
       및 `src/app/api/jira/webhook/route.ts:174` (`title.slice(0, 200)`)
     - 제목은 200자 유지, description에 원문 전문 저장 (이미 description 값이 있으면 덮지 않게 주의)
   - **② Claude Code 예약 실행 (routine)**: `/schedule`로 주기 실행(주기 미정 — 1시간 안 제시됨).
     새로 들어온 slack/jira task 중 미정리분을 찾아 description 원문을 읽고 제목을 할일형으로 교체.
     구독 사용량으로 처리 → 추가 비용 0원. 실시간 아님(최대 주기만큼 지연)을 사용자가 수용함.
3. **모델**: 사용자가 Opus 4.8 선택 (이 사용자는 서브에이전트도 항상 opus — 메모리 참조).

## 설계 시 풀어야 할 것 (스펙 단계 질문거리)

- **재처리 방지 + 사용자 수정 보호**: 한 번 정리한 task, 사용자가 직접 이름 고친 task는 다시 건드리면 안 됨.
  - 후보: `name_locked` 컬럼 재사용 (현재는 노션発 task 전용 시맨틱 — `docs/architecture/notion` 관련 문서·CLAUDE.md 참조).
    슬랙/JIRA task에선 미사용이므로 "사람/AI가 확정한 이름" 플래그로 확장 가능. 단, UI의 제목 수정이
    노션 외 소스에는 name_locked를 안 보내므로(태스크카드 인라인 에디터·상세 모달 둘 다) 확장 시 UI도 같이 수정 필요.
  - 또는 새 컬럼(`ai_titled_at` 등) — 이 경우 마이그레이션 먼저 Supabase 적용 후 코드 배포 (CLAUDE.md 배포 프로세스).
- **routine의 데이터 접근 방법**: prod API(`https://wid-teal.vercel.app/api/tasks`) 직접 호출 vs Supabase MCP.
  헤드리스 실행에선 interactive 인증 MCP가 없을 수 있음 → prod API 호출이 단순할 듯. RLS/인증 전제는
  `docs/architecture/realtime.md` 참조.
- **정리 프롬프트**: 한국어 할일형("~하기"), 핵심만, JIRA 키(예: MD-104)는 유지할지 등 톤 결정.
- **주기**: 1시간? 사용자에게 확인.
- JIRA 댓글 알림(snippet 140자)도 대상인지 — `src/app/api/jira/webhook/route.ts:109`.

## 진행 방법

1. `superpowers:brainstorming` 스킬로 시작 (위 질문들 확인) → 스펙 `docs/superpowers/specs/`
2. plan → 구현(서브에이전트 opus) → 검증 → 배포 (CLAUDE.md 배포 프로세스 준수)
3. routine 등록은 `/schedule` 스킬.

## 이번 세션(2026-06-05)에서 끝낸 것 (참고 맥락)

- TASK 상세 모달 전면 개편 완료: 즉시 렌더(tasks/issues prop 시드 + 백그라운드 재검증),
  edit-in-place 자동 저장(저장 버튼 폐지), ISSUE/하위 TASK 위계 뱃지, SourceIcon 브랜드 로고 헤더
  (출처 텍스트 없음), 닫기 X 제거(바깥 클릭·ESC), 본문 30px 정렬.
- 계약 문서: `docs/architecture/inline-editing.md` 하단 "TaskDetailPanel 계약" 섹션.
- 스펙/플랜: `docs/superpowers/specs/2026-06-05-task-detail-modal-redesign-design.md`,
  `docs/superpowers/plans/2026-06-05-task-detail-modal-redesign.md`
