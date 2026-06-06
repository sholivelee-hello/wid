'use client';
import { useSyncExternalStore } from 'react';

/** 미디어쿼리 구독 훅. SSR에서는 false (hydration 후 정정).
 *  분기 원칙(모바일 spec 기술 결정): 레이아웃 분기 = 뷰포트 폭,
 *  인터랙션 분기 = 포인터 능력('(pointer: coarse)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
