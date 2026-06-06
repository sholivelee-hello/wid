'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday as dfIsToday,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface MiniMonthGridProps {
  /** 표시할 달 — 페이지의 기존 monthCursor 상태를 그대로 받는다 (월 네비 UI는 페이지가 담당). */
  monthCursor: Date;
  /** 현재 선택된 날짜 — 페이지의 기존 selectedDate 상태. */
  selected: Date | null;
  /** 날짜 탭 콜백 — 페이지의 선택 상태를 갱신한다. */
  onSelect: (d: Date) => void;
  /**
   * 날짜별 밀도 카운트 (yyyy-MM-dd → 완료 task + 이벤트 합).
   * 페이지에서 기존 tasks/events 상태로 집계해 넘긴다 — 새 fetch 금지.
   */
  countByDate: Map<string, number>;
  /** 오늘 날짜 문자열 (yyyy-MM-dd). 없으면 date-fns isToday로 판정. */
  today?: string;
}

// EventMonthGrid와 동일하게 주중 전용 (토/일 제외, 월요일 시작) — WID는 평일 업무용 달력.
const WEEKDAYS = ['월', '화', '수', '목', '금'];

/** 밀도 점 개수: 1-2개=점1, 3-4개=점2, 5개 이상=점3. 0개면 0. */
function densityDots(count: number): number {
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

/**
 * 모바일 전용 미니 달력 — 데스크톱 EventMonthGrid의 축약판.
 * 셀: 날짜 숫자 + 밀도 점. 월 네비·데이터는 부모(/history)가 소유.
 */
export function MiniMonthGrid({
  monthCursor,
  selected,
  onSelect,
  countByDate,
  today: todayProp,
}: MiniMonthGridProps) {
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthCursor]);

  // 주 단위로 잘라 행 구성 후, 주중(월~금)만 노출.
  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      out.push(days.slice(i, i + 5)); // 토/일 제외
    }
    return out;
  }, [days]);

  const selectedStr = selected ? format(selected, 'yyyy-MM-dd') : null;

  return (
    <div className="w-full select-none">
      {/* 요일 헤더 (월~금) */}
      <div className="grid grid-cols-5 gap-px mb-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-[11px] font-medium text-muted-foreground py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* 주 행 */}
      <div className="space-y-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-5 gap-px">
            {week.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, monthCursor);
              const today = todayProp ? dateStr === todayProp : dfIsToday(day);
              const isSelected = selectedStr === dateStr;
              const dots = densityDots(countByDate.get(dateStr) ?? 0);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onSelect(day)}
                  aria-label={`${format(day, 'M월 d일')} 선택`}
                  aria-pressed={isSelected}
                  className={cn(
                    // 터치 타겟 — 셀 자체가 호스트를 확장 (오버레이 금지: 인접 셀 가로채기 위험).
                    'min-h-11 flex flex-col items-center justify-center gap-1 rounded-md transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    !isSelected && 'hover:bg-accent/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-7 w-7 rounded-full text-xs tabular-nums',
                      isSelected && 'bg-primary text-primary-foreground font-semibold',
                      !isSelected && today && 'ring-1 ring-primary text-primary font-semibold',
                      !isSelected && !today && isCurrentMonth && 'text-foreground',
                      !isSelected && !today && !isCurrentMonth && 'text-muted-foreground/50',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* 밀도 점 — 가로 나열. 선택일은 점 색을 반전(primary-foreground)해 원 안에서 묻히지 않게. */}
                  <span className="flex items-center justify-center gap-0.5 h-1">
                    {Array.from({ length: dots }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 w-1 rounded-full',
                          isSelected ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
