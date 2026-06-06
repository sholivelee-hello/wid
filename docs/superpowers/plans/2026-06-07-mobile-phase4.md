# 모바일 최적화 4라운드 플랜 (바텀 액션 시트 · 타이포 밀도 · 클리핑 감사)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 계약 수준 명세.

**Goal:** ① 폰에서 task 꾹 누름/⋯이 PC식 작은 메뉴 대신 **바텀 액션 시트**(행 52px)를 띄운다 ② 모바일 메타 글자·칩 밀도 완화 ③ 히트 영역 클리핑 한계 감사·보정. (사용자 결정 2026-06-07: 재평가 잔여 A·C 진행, B·D·E 스킵, 액션 시트 신규 채택)

**검증 공통:** build exit 0 + lint 베이스라인 13건 초과 금지. 데스크톱(fine pointer + lg) 회귀 0 — PC 우클릭/hover ⋯ 드롭다운은 현행 유지.

---

### Task F: 바텀 액션 시트 (꾹 누름 + ⋯ 통일)

**Files:**
- Create: `src/components/tasks/task-action-sheet.tsx`
- Modify: `src/components/tasks/task-card.tsx`

- **SHEET_KIT 접근**: task-card의 기존 `renderActionItems(M: MenuKit)` 단일 정의를 그대로 재사용한다. 시트용 MenuKit 호환 컴포넌트 세트(SHEET_KIT)를 task-action-sheet.tsx에 구현: `Item` = 행 높이 `min-h-[52px]` 풀폭 버튼(아이콘+라벨, destructive variant는 text-destructive), `Separator` = hairline, `Sub`/`SubTrigger`/`SubContent` = 내부 내비게이션 컨텍스트로 **시트 안에서 목록 교체**(SubTrigger 탭 → SubContent 뷰로 전환 + 상단 ‹ 뒤로 헤더, 뒤로 탭 → 메인 목록 복귀).
- 시트 컨테이너: 기존 vaul `Drawer`(ui/drawer.tsx) 재사용 — 자동 높이(콘텐츠만큼), 손잡이, 하단 safe-area, 맨 아래 "닫기" 행. 항목 탭 시 액션 실행 후 시트 닫힘.
- **task-card.tsx 분기** (isCoarse = 기존 `useMediaQuery('(pointer: coarse)')`):
  - coarse: base-ui ContextMenu 래핑 제거(롱프레스 가로채기 방지). 대신 **자체 롱프레스 감지**: touchstart 후 500ms 유지 + 이동 10px 미만이면 발동 → 시트 열기 + 이후 합성 click 1회 무시(스와이프 가드 패턴 재사용). SwipeActionRow와 공존 — 가로 스와이프 모드 진입 시 롱프레스 타이머 취소.
  - coarse의 ⋯ 버튼: DropdownMenu 대신 같은 시트 열기.
  - fine(데스크톱): 현행 그대로 (우클릭 ContextMenu + hover ⋯ DropdownMenu).
  - editing 중엔 시트·롱프레스 비활성(기존 규칙 동일).
- 다크 토큰만, 한국어 주석. `navigator.vibrate(10)` 가능하면 롱프레스 발동 시 햅틱(미지원 무시).

### Task A': 모바일 타이포 밀도 완화

**Files:** Modify `src/components/tasks/task-card.tsx`(메타 줄), `src/components/tasks/task-detail-panel.tsx`(칩 줄) — **Task F 완료 후 착수** (task-card 충돌 방지)

- 카드 메타 줄(`text-[13px]`, 날짜·요청자·sub 토글)을 모바일(sm 미만 `max-sm:`)에서 14px로, 뱃지류 `text-[10px]`/`text-[11px]`는 11~12px로 — **데스크톱 불변**(max-sm 변형만 추가).
- 상세 칩 줄: 칩 `gap` 모바일 상향(`max-sm:gap-2`)으로 3~4줄 wrap의 답답함 완화. 칩 자체 높이는 기존 터치 보강 유지.
- 시각 변경은 다크 기준 확인. 과한 개편 금지 — 크기·간격 미세 조정만.

### Task C': 히트 영역 클리핑 감사·보정

**Files:** 감사 후 결정 (`task-card.tsx`는 수정 금지 — F·A' 소유. 발견 시 보고만)

- `grep -rn "overflow-hidden" src/components src/app`으로 touch-hitarea(-y) 적용 컨트롤의 조상에 overflow-hidden이 있는 케이스를 전수 조사.
- 각 케이스: overflow-hidden이 시각적으로 불필요하면 제거, 필요하면(라운드 클리핑 등) 컨트롤 쪽에 내부 패딩 확보 또는 한계 수용을 globals.css 주석 카탈로그에 추가.
- 산출물: 수정 + 케이스 목록(파일:라인, 처치) 보고.

### Task G: 검증 + 배포

- build + lint(베이스라인) → 데스크톱 회귀(우클릭·hover ⋯·드롭다운) 확인 → master 병합 → push → prod 라우트 200 + 신버전 마커 확인 → 사용자 보고 (기승인 플로우)
