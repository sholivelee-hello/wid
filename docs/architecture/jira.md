# JIRA 연동 (웹훅 → TASK)

JIRA(mirapartners.atlassian.net)의 **알림 4종**을 WID TASK로 들여온다. 작업 목록 import가 아니라 Slack 이모지 흐름과 같은 "알림 → 인박스" 모델이다. (2026-06-04 브레인스토밍 결정: 웹훅 방식, 폴링 아님)

## 알림 4종 → TASK 매핑

| 알림 | 감지 조건 | TASK title |
|---|---|---|
| ① 나에게 새로 할당 | `jira:issue_created`에서 assignee=나, 또는 `jira:issue_updated` changelog의 assignee `to`=나 | `{KEY} 할당: {summary}` |
| ② 댓글에서 나를 멘션 | `comment_created` body에 내 accountId 멘션 | `{KEY} 멘션: {댓글 앞 140자}` |
| ③ 내 이슈에 새 댓글 | `comment_created` + 이슈 assignee=나 (멘션 아닐 때) | `{KEY} 댓글: {댓글 앞 140자}` |
| ④ 내 이슈의 상태 변경 | `jira:issue_updated` changelog에 `status` 항목 + reporter=나 (할당 아닐 때) | `{KEY} 상태: {fromString} → {toString} — {summary}` |

- **내가 한 행동은 제외**: 스스로 할당(actor=나), 내가 쓴 댓글(author=나), 내가 바꾼 상태(actor=나)는 건너뛴다 — JIRA 자체 알림 정책과 동일.
- 한 댓글이 ②와 ③에 동시 해당하면 **멘션(②) 우선**, task는 1개만.
- 한 `issue_updated` changelog에 assignee→나 와 status 변경이 함께 있으면 **할당(①) 우선**, task는 1개만 (②③ 멘션 우선과 같은 단순화).
- reporter=나 이면서 assignee=나 인 이슈도 ④가 동작한다 (actor≠나 조건만으로 충분).
- requester = 행동한 사람(할당한 사람/댓글 작성자/상태 변경자) displayName. requested_at = 웹훅 timestamp.

## 엔드포인트 계약 (`/api/jira/webhook`)

- **인증**: JIRA Cloud 시스템 웹훅은 서명 미지원 → URL 쿼리 `?token=`을 `JIRA_WEBHOOK_SECRET`과 비교. 불일치 403.
- **중복 방지**: `jira_events` 테이블(event_key PK, slack_events와 동일 패턴). key 형식 — 할당 `assign:{issue.id}:{changelog.id}`, 댓글 `comment:{comment.id}`.
- **댓글 body**: wiki 문자열(`[~accountid:...]`)과 ADF 객체 둘 다 처리(`commentBodyToText`). 멘션 감지는 직렬화 문자열에 내 accountId 포함 여부로 — 두 포맷 모두 커버.
- **사이트 주소**: `issue.self`의 origin에서 유도, 실패 시 mirapartners.atlassian.net fallback.
- **jira_url**: `{site}/browse/{KEY}`, 댓글이면 `?focusedCommentId={id}` 추가. 우클릭 "원본 열기"가 이 URL을 연다(`sourceOpenUrl`).

## 환경변수

| 키 | 값 |
|---|---|
| `JIRA_WEBHOOK_SECRET` | 웹훅 URL token (openssl rand로 생성, .env.local + Vercel) |
| `JIRA_OWNER_ACCOUNT_ID` | `712020:d5ec8d21-0173-41a8-8714-8a7d4813e601` (이신희) |

## JIRA 쪽 등록 (관리자)

설정(톱니) → 시스템 → 웹훅(WebHooks) → 만들기:

- URL: `https://wid-teal.vercel.app/api/jira/webhook?token={JIRA_WEBHOOK_SECRET}`
- 이벤트: **Issue → created, updated** / **Comment → created**
- JQL 필터는 비워둠 (필터링은 WID 쪽에서 accountId로)

로컬 개발 시에는 Slack과 동일하게 cloudflared 터널 URL로 임시 교체 필요.

## 스키마

- `tasks.jira_url`, `tasks.jira_issue_key` (migration 009)
- `jira_events` dedup 테이블 (migration 009)
- `tasks.source` CHECK에 'jira'는 008에서 이미 허용됨
- SourceIcon의 jira 슬롯은 placeholder 회색 점 → 공식 Jira 로고(#2684FF 단색)로 교체 (브랜드 아이콘 예외 — `docs/architecture/issues.md`)

## 비고: Slack relay 경로와의 관계

`/api/slack/webhook`에 Workflow Builder로 JIRA 알림을 중계하던 임시 경로(`SLACK_JIRA_RELAY_CHANNEL`)가 남아 있다. 직접 웹훅이 안정화되면 그 경로는 제거 후보 (env를 비워두면 비활성).
