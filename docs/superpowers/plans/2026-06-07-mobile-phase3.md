# 모바일 최적화 3라운드 플랜 (재평가 74/100 잔여 갭)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 계약 수준 명세 — 구현 에이전트가 대상 파일을 직접 읽고 구현.

**Goal:** 2026-06-07 UX 재평가(38→74)가 남긴 갭 3개를 닫는다. 목표 체감: 바텀시트에서 키보드가 입력칸을 못 가리게, 2차 동선(필터·이슈 상세)도 손가락으로 정확히.

**근거:** 재평가 "남은 갭 Top 3" — ① 바텀시트 키보드 휴리스틱(中) ② 2차 동선 터치 타겟(下~中) ③ issues/[id] 제목 줄 겹침(下~中). (토스트/FAB 겹침은 e7dd2eb로 기해소.)

**검증 공통:** build exit 0 + lint 베이스라인 13건 초과 금지. 데스크톱 회귀 0.

---

### Task A: 바텀시트 키보드 정밀 대응 (visualViewport)

**Files:** Modify `src/components/tasks/task-detail-panel.tsx` (필요시 `src/lib/use-media-query.ts` 옆에 새 훅 `src/lib/use-visual-viewport.ts`)

- 새 훅 `useVisualViewportHeight()`: `window.visualViewport`의 height를 구독(resize 이벤트, useSyncExternalStore). visualViewport 미지원이면 null.
- 모바일 Drawer에서: 키보드가 떠서 visualViewport height가 줄면 시트 내부 스크롤 영역의 하단 패딩을 `(window.innerHeight - visualViewport.height)`만큼 동적으로 추가 — 키보드 높이만큼 스크롤 여유가 생겨 어떤 입력칸도 가려지지 않음. 키보드 내려가면 0으로 복귀.
- 기존 onFocusCapture scrollIntoView(250ms)는 유지(보완재).
- iOS Safari 기준으로 주석에 동작 원리 설명. 데스크톱 Dialog 경로는 불변.

### Task B: 2차 동선 터치 타겟 마감

**Files:** Modify `src/components/inbox/inbox-filter-popover.tsx`(칩 h-7), `src/app/issues/[id]/page.tsx`(인라인 추가 h-8 Input·버튼, 제목 줄), `src/components/tasks/task-detail-panel.tsx`(푸터 sm 버튼·칩 줄)

- 필터 팝오버 ChipRow: 칩에 `touch-hitarea-y` 적용(가로 빽빽 — 세로 전용 규칙, globals.css 주석 참조). wrap 줄 간격이 좁으면 `pointer-coarse:gap-y-2`로 세로 간격만 보정.
- issues/[id] 인라인 task 추가 줄: Input·버튼에 `pointer-coarse:min-h-11` (이 줄은 단독 배치라 호스트 확장 안전).
- 상세 푸터 버튼들: Button 컴포넌트라 touch-hitarea가 이미 있음 — 푸터가 가로로 빽빽하면(인접 가로채기) 해당 버튼들만 `touch-hitarea-y`로 교체하는 식으로 실측 후 판단. TaskChipButton류 커스텀 버튼에 touch-hitarea(-y) 누락분 보강.
- **issues/[id] 제목 줄**: 긴 이슈명 + 편집/삭제 버튼이 한 줄 경합 — 모바일에서 버튼 줄을 제목 아래로 내리거나(`flex-wrap`) 버튼을 ⋯ 메뉴로 접기. 데스크톱 불변.

### Task C: 최종 검증 + 배포

- build + lint(베이스라인) → 데스크톱 회귀 확인 → 커밋 → master 병합 → push → Vercel prod → 라우트 200 확인 (사용자 기승인 플로우와 동일)
