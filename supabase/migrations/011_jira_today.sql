-- 011_jira_today.sql
-- JIRA에서 들어오는 TASK를 기본적으로 "오늘"에 넣기 위한 서버 측 플래그.
--
-- 배경: "오늘" 소속은 두 갈래로 결정된다 — (1) 브라우저 localStorage의 explicit
-- 집합(사용자의 태양 아이콘 탭), (2) deadline-auto(마감 임박). JIRA TASK는 서버
-- 웹훅에서 생성되므로 localStorage를 건드릴 수 없고, 가짜 마감일을 박으면 "마감"
-- 뱃지가 붙는 부작용이 있다. 그래서 DB에 명시적 today 플래그를 둔다.
--
-- 동작: JIRA 웹훅이 is_today=true로 생성 → /today가 effective 집합의 seed로 폴딩
-- (deadline-auto와 동급의 derived 레이어). 사용자가 "오늘에서 빼기"를 하면 이 플래그를
-- false로 PATCH → /inbox(전체)로 내려간다. (docs/architecture/today.md, jira.md)
--
-- 추가형(default false)이라 기존 행/코드에 영향 없음.

alter table tasks
  add column if not exists is_today boolean not null default false;

comment on column tasks.is_today is
  'Server-side explicit "오늘" flag. Set true by JIRA ingestion so the task lands in /today by default; cleared (false) when the user removes it from 오늘, dropping it to /inbox. Derived into the effective today set alongside deadline-auto.';
