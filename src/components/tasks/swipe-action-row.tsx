'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeActionRowProps {
  /** false면 children을 그대로 반환 — 데스크톱/fine pointer에서 비용 0. */
  enabled: boolean;
  /** 왼쪽으로 밀어 완료. 없으면 그 방향으로 움직이지 않는다. */
  onSwipeComplete?: () => void;
  /** 오른쪽으로 밀어 보류. 없으면 그 방향으로 움직이지 않는다. */
  onSwipePend?: () => void;
  children: React.ReactNode;
}

// 가로 의도 판정 임계: 손가락이 12px 이상 가로로 움직이고, 가로 이동이 세로보다
// 우세할 때만 스와이프 모드로 들어간다. 미만이면 세로 스크롤에 양보한다.
const INTENT_PX = 12;
// row가 따라 움직일 수 있는 최대 거리 = 컨테이너 폭의 50%.
const MAX_RATIO = 0.5;

// 양쪽 힌트 레이어 공통 구조 — 정렬쪽/배경/아이콘만 방향별로 덧입힌다.
const HINT_BASE = 'absolute inset-0 flex items-center px-5 rounded-md';

/**
 * 한 손가락 가로 스와이프로 task 행에 액션을 거는 래퍼.
 *
 * 제스처 판정 규칙(한국어 설명):
 *  1) touchstart에서 시작 좌표를 기록한다.
 *  2) touchmove에서 처음으로 의도를 판정한다 — |dx| > |dy| 이고 |dx| > 12px이면
 *     "가로 스와이프"로 확정(swiping=true). 반대로 세로가 우세하면 "스크롤"로
 *     확정하고(lockedRef='scroll') 이후 그 제스처가 끝날 때까지 row를 절대
 *     움직이지 않는다 — 한 번 스크롤로 판정되면 끝까지 무시.
 *  3) 스와이프 모드에서는 row를 translateX로 손가락을 따라가게 하되, 방향별로
 *     해당 핸들러가 없으면 그 방향(음수=완료/양수=보류)으로는 0에 고정한다.
 *     이동 폭은 ±컨테이너폭*50%로 제한한다.
 *  4) touchend에서 |dx| >= 임계(max(96px, 폭*0.35))면 해당 방향 액션을 실행하고,
 *     미만이면 transition으로 0으로 스냅백한다.
 *
 * touchend 직후 브라우저가 합성 click을 한 번 쏘는데, 스와이프 모드였다면
 * 그 click이 카드의 onClick(상세 열기)을 오발하지 않도록 capture 단계에서
 * 1회 막는다(suppressClickRef). 합성 click이 끝내 안 오는 경우(손가락이 요소
 * 밖에서 떨어짐 등)를 대비해 타이머로 가드를 자동 해제한다 — 안 그러면 다음 탭
 * 1회가 영구히 삼켜진다.
 *
 * 한계: 제스처 도중 enabled prop이 바뀌면(예: 다른 손가락 액션으로 isDone 전환)
 * if(!enabled) early-return 때문에 서브트리가 리마운트되어 진행 중인 스냅백
 * 애니메이션이 끊긴다. 실사용상 드물어 수정하지 않고 명시만 한다.
 */
export function SwipeActionRow({
  enabled,
  onSwipeComplete,
  onSwipePend,
  children,
}: SwipeActionRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // null = 아직 판정 전, 'swipe' = 가로 스와이프, 'scroll' = 세로 스크롤(무시).
  const lockedRef = useRef<'swipe' | 'scroll' | null>(null);
  // touchend 후 합성 click 1회 무시 가드.
  const suppressClickRef = useRef(false);
  // 가드 자동 해제 타이머 — 합성 click이 끝내 안 올 때를 대비.
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // dx state는 비동기 갱신이라 touchend 판정 시점에 stale일 수 있어 ref로 미러링.
  const dxRef = useRef(0);

  const [dx, setDx] = useState(0);
  const [reached, setReached] = useState(false);
  const [animating, setAnimating] = useState(false);

  // unmount 시 가드 타이머 정리(리크 방지).
  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  // enabled=false면 래핑 비용 없이 children 그대로 — 데스크톱 동작 회귀 0.
  if (!enabled) return <>{children}</>;

  const maxOffset = () => (containerRef.current?.offsetWidth ?? 0) * MAX_RATIO;
  const threshold = () =>
    Math.max(96, (containerRef.current?.offsetWidth ?? 0) * 0.35);

  const reset = () => {
    startRef.current = null;
    lockedRef.current = null;
    dxRef.current = 0;
    setDx(0);
    setReached(false);
    setAnimating(false);
  };

  // dx를 state·ref 동시 갱신 — touchend가 ref를 읽어 stale 판정 방지.
  const updateDx = (next: number) => {
    dxRef.current = next;
    setDx(next);
  };

  // 합성 click 가드를 켜고, 끝내 click이 안 오면 자동 해제하도록 타이머를 건다.
  const armClickGuard = () => {
    suppressClickRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 500);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    // 방어적 초기화 — 이전 제스처가 남긴 가드가 있으면 해제.
    suppressClickRef.current = false;
    if (suppressTimerRef.current) {
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = null;
    }
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    lockedRef.current = null;
    dxRef.current = 0;
    setAnimating(false);
    setDx(0);
    setReached(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start) return;
    if (lockedRef.current === 'scroll') return; // 한 번 스크롤이면 끝까지 무시
    // 멀티터치 진입 → 제스처 취소하고 스냅백.
    if (e.touches.length > 1) {
      reset();
      setAnimating(true);
      return;
    }
    const t = e.touches[0];
    const rawDx = t.clientX - start.x;
    const rawDy = t.clientY - start.y;

    // 아직 의도 미확정 → 판정
    if (lockedRef.current === null) {
      if (Math.abs(rawDx) > Math.abs(rawDy) && Math.abs(rawDx) > INTENT_PX) {
        lockedRef.current = 'swipe';
      } else if (Math.abs(rawDy) > INTENT_PX) {
        lockedRef.current = 'scroll';
        return;
      } else {
        return; // 아직 어느 쪽도 아님
      }
    }

    if (lockedRef.current !== 'swipe') return;

    // 방향별 핸들러 부재 시 그 방향으로는 움직이지 않음.
    // rawDx < 0 = 왼쪽(완료), rawDx > 0 = 오른쪽(보류).
    let next = rawDx;
    if (next < 0 && !onSwipeComplete) next = 0;
    if (next > 0 && !onSwipePend) next = 0;

    // ±50% 제한
    const lim = maxOffset();
    if (next > lim) next = lim;
    if (next < -lim) next = -lim;

    updateDx(next);
    // 임계 도달 여부도 이벤트 핸들러 안에서 계산해 둔다(ref 접근은 여기서만).
    setReached(Math.abs(next) >= threshold());
  };

  const handleTouchEnd = () => {
    if (lockedRef.current !== 'swipe') {
      reset();
      return;
    }
    const th = threshold();
    // state 대신 ref를 읽어 stale 판정 방지.
    const finalDx = dxRef.current;
    const passed = Math.abs(finalDx) >= th;
    // 스와이프 모드였으면 이어지는 합성 click 1회 무시(상세 오발 방지).
    armClickGuard();

    if (passed) {
      if (finalDx < 0 && onSwipeComplete) onSwipeComplete();
      else if (finalDx > 0 && onSwipePend) onSwipePend();
    }
    // 액션 실행 여부와 무관하게 행은 제자리로 스냅백.
    // reset()이 animating을 false로 내리므로 그 뒤에 true로 켠다.
    reset();
    setAnimating(true);
  };

  // 스와이프 직후 합성 click을 capture 단계에서 1회만 차단.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const showCompleteHint = dx < 0; // 왼쪽으로 미는 중 = 완료
  const showPendHint = dx > 0; // 오른쪽으로 미는 중 = 보류

  return (
    <div
      ref={containerRef}
      // touch-pan-y: 세로 스크롤은 브라우저에 맡기고 가로 패닝만 우리가 가로챈다.
      // React onTouchMove는 passive라 JS로 preventDefault가 안 먹으므로, 가로
      // 스와이프 중 페이지가 함께 세로 스크롤되는 걸 CSS로 차단한다. 이 컨테이너는
      // enabled=true일 때만 렌더되므로(위 early-return) 비활성 행엔 영향 0.
      className="relative overflow-hidden touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        reset();
        setAnimating(true);
      }}
      onClickCapture={handleClickCapture}
    >
      {/* 힌트 레이어 — row 뒤 배경. 미는 방향에 따라 한쪽만 표시. 두 레이어는
        * HINT_BASE로 구조(위치·정렬·라운드·패딩)를 통일하고, 방향별로 정렬쪽·
        * 배경·아이콘·강조색만 다르게 한다. 새 색 금지. */}
      {showCompleteHint && (
        <div aria-hidden className={cn(HINT_BASE, 'justify-end bg-primary/15')}>
          <CheckCircle2
            className={cn(
              'h-5 w-5 transition-colors',
              reached ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        </div>
      )}
      {showPendHint && (
        <div aria-hidden className={cn(HINT_BASE, 'justify-start bg-muted')}>
          <PauseCircle
            className={cn(
              'h-5 w-5 transition-colors',
              reached ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>
      )}

      {/* 실제 행 — translateX로 손가락을 따라간다. */}
      <div
        className={cn('relative', animating && 'transition-transform duration-200')}
        style={{ transform: `translateX(${dx}px)` }}
        onTransitionEnd={() => setAnimating(false)}
      >
        {children}
      </div>
    </div>
  );
}
