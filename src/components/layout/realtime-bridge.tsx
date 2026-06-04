'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

// 서버 broadcast(wid-tasks) → 기존 화면 갱신 이벤트(task-created) 다리.
// 웹훅/sync가 broadcast로 "변경 있음" 신호를 쏘면, 여기서 받아
// window 'task-created' CustomEvent로 변환한다 — inbox/today/issues/사이드바
// 카운트가 이미 이 이벤트를 듣고 /api/tasks를 재조회한다.
// 데이터는 broadcast에 실리지 않으므로 RLS와 무관 (docs/architecture/realtime.md).
export function RealtimeBridge() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('wid-tasks')
      .on('broadcast', { event: 'changed' }, () => {
        // 연타(여러 task 동시 생성) 대비 간단 debounce.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent('task-created'));
        }, 600);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
