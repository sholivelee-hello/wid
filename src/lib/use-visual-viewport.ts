'use client';
import { useSyncExternalStore } from 'react';

/** visualViewport.height 구독 훅. 미지원 환경·SSR이면 null.
 *
 *  동작 원리: iOS Safari는 소프트 키보드가 떠도 layout viewport(=window.innerHeight)는
 *  줄어들지 않는다 — 페이지를 위로 밀어 올릴 뿐이라 하단 입력칸이 키보드 뒤로 가려진다.
 *  반면 visualViewport.height는 "지금 실제로 보이는" 영역이라 키보드 높이만큼 줄어든다.
 *  따라서 키보드 높이는 (window.innerHeight - visualViewport.height)로 가늠할 수 있고,
 *  이 차이를 스크롤 영역 하단 패딩으로 보정하면 가려진 입력칸을 끌어올릴 수 있다.
 *
 *  resize(키보드 등장/소멸로 높이 변화)와 scroll(키보드가 뜬 채 페이지가 밀려
 *  visualViewport offset이 바뀌는 경우) 둘 다 구독한다. */
export function useVisualViewportHeight(): number | null {
  return useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      if (!vv) return () => {};
      vv.addEventListener('resize', cb);
      vv.addEventListener('scroll', cb);
      return () => {
        vv.removeEventListener('resize', cb);
        vv.removeEventListener('scroll', cb);
      };
    },
    () => window.visualViewport?.height ?? null,
    () => null,
  );
}
