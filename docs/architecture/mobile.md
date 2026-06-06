# 모바일 최적화: 분기 정책 · 탭바 · 바텀시트 · 스와이프

2026-06-06~07 모바일 최적화 1·2단계(UX 38→74). spec `docs/superpowers/specs/2026-06-06-mobile-optimization-design.md`.

## 분기 정책 (두 축을 분리)

| 분기 | 기준 | 적용 | 구현 |
|---|---|---|---|
| 레이아웃 | **뷰포트 폭** | 탭바·돌아보기 미니 달력 = `lg` 미만(Tailwind `lg:hidden`) | CSS 클래스 |
| 레이아웃 | **뷰포트 폭** | 상세 바텀시트 = `sm`(640px) 미만 | `useMediaQuery('(max-width: 639px)')` |
| 인터랙션 | **포인터 능력** | grip 숨김·⋯ 상시 노출·스와이프·touch-hitarea = `pointer: coarse` | `useMediaQuery('(pointer: coarse)')` 또는 `pointer-coarse:` variant |

폭과 포인터는 별개 축이다 — 큰 태블릿(coarse 포인터 + lg 이상 폭)이나 좁은 데스크톱 창(fine 포인터 + lg 미만 폭)에서 각 분기가 독립적으로 옳게 동작하도록 의도적으로 나눴다.

훅: `src/lib/use-media-query.ts` — `useSyncExternalStore` 기반, SSR에서는 `false`(hydration 후 정정). 컴포넌트에서 비싼 인터랙션(스와이프)을 켜고 끌 때 사용.

## 탭바 + FAB 계약

`src/components/layout/mobile-tab-bar.tsx` — 데스크톱 사이드바를 lg 미만에서 대체. 햄버거 Sheet는 **제거됨**(이 탭바가 전부 담당).

- `nav`: `lg:hidden fixed bottom-0 inset-x-0 z-40`, `pb-[env(safe-area-inset-bottom)]`로 홈 인디케이터 회피. `navItems`(`src/lib/nav-items.ts`) 4개를 그대로 사용(사이드바와 동일 소스). 활성 = `text-primary`, 비활성 = `text-muted-foreground`.
- FAB: 우하단 `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`(탭바 위), `openModal`(QuickCapture, 새 task)을 연다. `/settings`에서는 숨김(`showFab`).
- **세트 규칙**: `layout.tsx`의 `<main>`에 `pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0`. 탭바 높이(`h-14`=3.5rem)만큼 본문 하단 패딩을 줘서 마지막 콘텐츠가 탭바에 가리지 않게 한다 — 탭바와 항상 같이 유지할 것.

## 바텀시트 계약

`src/components/tasks/task-detail-panel.tsx` — `isMobile = useMediaQuery('(max-width: 639px)')`로 컨테이너만 분기.

- sm 미만: vaul `Drawer` + `DrawerContent className="h-[92dvh]"`. sm 이상: 기존 `Dialog`.
- **내용 JSX는 Dialog와 공유** — 컨테이너(Drawer vs Dialog)만 갈라지고 본문은 한 벌. 두 경로가 어긋나지 않게 유지.
- 키보드 대응은 **휴리스틱**: `onFocusCapture` → 입력 포커스 시 250ms(키보드 등장 대기) 뒤 `scrollIntoView({ block: 'center' })`. `visualViewport` 기반 정밀 대응은 미해결 갭(아래 참조).

## 스와이프 계약

`src/components/tasks/swipe-action-row.tsx` — 한 손가락 가로 스와이프 래퍼.

- **게이트**: task-card에서 `enabled={isCoarse && !isDone && !editing}`. `enabled=false`면 children을 그대로 반환(데스크톱/fine 포인터 비용 0).
- **가로 의도 판정**: `touchmove`에서 `|dx| > |dy| && |dx| > 12px`이면 스와이프 확정. 세로가 우세하면 'scroll'로 잠그고 그 제스처 끝까지 무시.
- **임계**: `max(96px, 폭 35%)` 도달 시 액션 실행, 미만이면 스냅백. row 추종 한도는 폭의 50%.
- **방향**: 왼쪽 = 완료(되돌리기 토스트), 오른쪽 = 보류. 핸들러 없는 방향으로는 움직이지 않음.
- **click 오발 가드**: 스와이프 직후 합성 click을 capture 단계에서 1회 차단(상세 오발 방지). 합성 click이 끝내 안 올 때를 대비해 500ms 타이머로 자동 해제.
- **`touch-pan-y`**: React onTouchMove는 passive라 JS `preventDefault`가 안 먹으므로, 가로 스와이프 중 페이지가 함께 세로 스크롤되는 걸 CSS로 차단.
- **멀티터치 취소**: 두 손가락 진입 시 제스처 취소 + 스냅백.

## touch-hitarea / touch-hitarea-y 사용 규칙

`src/app/globals.css` `@utility` 정의 — `pointer: coarse`에서만 `::before` 투명 오버레이로 누를 수 있는 영역을 44px 보장(시각 크기는 그대로).

- **단독 컨트롤**(카드 위 완료 토글 등) → `touch-hitarea`: 가로·세로 모두 44px. "빗나간 탭이 카드를 여는" 문제 방지.
- **가로로 빽빽한 컨트롤**(보기 칩 등) → `touch-hitarea-y`: 높이만 44px. 가로 오버레이가 옆 컨트롤 탭을 가로채지 않게.
- 주의(globals.css 주석 참조): 인접 인터랙티브 요소 위로 겹치면 DOM 뒤쪽 요소가 탭을 가져간다. `overflow-hidden` 조상 안에서는 오버레이가 잘려 보장이 줄어든다.

## 토스트 위치

`src/components/ui/sonner.tsx` — lg 미만(탭바 있음)에서 Toaster `offset.bottom = calc(8.5rem + env(safe-area-inset-bottom))`. 우하단 토스트의 "되돌리기" 버튼이 FAB에 가리는 문제 방지. 데스크톱은 기존 bottom-right 그대로.

## 폰 reorder 미지원

폰에서 순서 변경은 지원하지 않는다 — 상세는 `dnd.md` 모바일(터치) 정책 참조.

## 남은 갭 (2026-06-07 UX 재평가 74/100)

1. **바텀시트 키보드**: `visualViewport` 기반 정밀 대응 미구현 — 현재는 250ms scrollIntoView 휴리스틱뿐.
2. **2차 동선 터치 타겟**: 필터 팝오버 chip `h-7`, `issues/[id]` 인라인 추가 `h-8`, 상세 푸터 sm 버튼 등이 44px 미만.
3. **issues/[id] 제목 줄 버튼 겹침**.
