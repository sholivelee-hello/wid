'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** 평상시 라벨 (예: '삭제', '휴지통'). 무장 상태 라벨은 항상 '진짜 삭제'. */
  label: string;
  /** 평상시 버튼 스타일. 무장(armed) 상태는 항상 destructive 솔리드. */
  idleVariant?: 'destructive' | 'ghost';
  /** 항상 적용되는 클래스 (레이아웃 보정 등). */
  className?: string;
  /** 평상시에만 적용되는 클래스 — muted 텍스트 톤 등, 무장 상태와 충돌하는 것. */
  idleClassName?: string;
  onDelete: () => void;
}

/** 2단계 인라인 삭제 버튼 — 확인 모달 없음 (사용자 결정 2026-07-02).
 *  첫 클릭에 그 자리에서 '진짜 삭제'로 바뀌고, 3초 안에 다시 클릭하면 실제
 *  삭제. 3초가 지나면 원래 버튼으로 되돌아간다 (오발 방지). */
export function TwoStepDeleteButton({
  label, idleVariant = 'destructive', className, idleClassName, onDelete,
}: Props) {
  const [armed, setArmed] = useState(false);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
  }, []);

  const handleClick = () => {
    if (armed) {
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
      setArmed(false);
      onDelete();
      return;
    }
    setArmed(true);
    disarmTimerRef.current = setTimeout(() => setArmed(false), 3000);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={armed ? 'destructive' : idleVariant}
      className={cn(
        className,
        armed ? 'animate-in fade-in-0 ring-2 ring-destructive/40' : idleClassName,
      )}
      onClick={handleClick}
    >
      <Trash2 className="h-4 w-4 mr-1" />
      {armed ? '진짜 삭제' : label}
    </Button>
  );
}
