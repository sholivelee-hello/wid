'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * 본문 콘텐츠 컬럼 래퍼.
 *
 * 대부분의 페이지는 860px 중앙 정렬(한국어 가독 폭, "비워둔다" 원칙)이지만,
 * 돌아보기(/history)는 캘린더 + 완료 task 패널이 나란히 놓이는 2단 레이아웃이라
 * 폭 제한이 답답해 이 탭만 전폭으로 예외 처리한다.
 *
 * layout.tsx는 server component라 usePathname을 쓸 수 없어 작은 client
 * 래퍼로 분리한다.
 */
export function ContentColumn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullWidth = pathname?.startsWith('/history') ?? false;

  return (
    <div
      className={cn(
        'px-4 md:px-6 py-4 md:py-6 animate-fade-in',
        isFullWidth ? 'w-full' : 'mx-auto w-full max-w-[860px]',
      )}
    >
      {children}
    </div>
  );
}
