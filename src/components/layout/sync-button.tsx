'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 설정 페이지(notion-mapping.tsx)와 동일한 localStorage 키 — 마지막 동기화
// 시각/결과/이력을 같은 형태로 기록해서 설정 표시와 어긋나지 않게 한다.
const LS_KEY = 'wid:notion:last-sync';
const LS_RESULT_KEY = 'wid:notion:last-sync-result';
const LS_HISTORY_KEY = 'wid:notion:history';
const HISTORY_MAX = 7;

type SyncResult = 'success' | 'failed';
type HistoryEntry = { ts: number; result: SyncResult };

function pushHistory(entry: HistoryEntry) {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const prev: HistoryEntry[] = Array.isArray(parsed)
      ? parsed.filter(
          (e): e is HistoryEntry =>
            e &&
            typeof e.ts === 'number' &&
            (e.result === 'success' || e.result === 'failed'),
        )
      : [];
    const next = [...prev, entry];
    while (next.length > HISTORY_MAX) next.shift();
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function recordSync(result: SyncResult) {
  const now = new Date();
  try {
    localStorage.setItem(LS_KEY, now.toISOString());
    localStorage.setItem(LS_RESULT_KEY, result);
  } catch {
    /* ignore */
  }
  pushHistory({ ts: now.getTime(), result });
}

interface SyncResponse {
  created: number;
  updated: number;
  total: number;
  issuesResolved: number;
  errors?: { dbId: string; message: string }[];
}

export function SyncButton({ collapsed }: { collapsed?: boolean }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/notion/sync', { method: 'POST' });
      if (!res.ok) throw new Error('sync failed');
      const data: SyncResponse = await res.json();

      // 목록 갱신: inbox/today/이슈상세/사이드바 카운트 리스너가 fetch 재호출.
      // JIRA 웹훅으로 서버에는 들어왔지만 화면에 안 보이던 task도 함께 반영.
      window.dispatchEvent(new CustomEvent('task-created'));

      const failedCount = data.errors?.length ?? 0;
      if (failedCount > 0) {
        recordSync('failed');
        toast.error('동기화 일부 실패 — 일부 Notion DB에 접근하지 못했어요');
      } else {
        recordSync('success');
        if (data.created > 0 || data.updated > 0) {
          toast.success(`동기화 완료 — 새 ${data.created}건 · 업데이트 ${data.updated}건`);
        } else {
          toast.success('동기화 완료 — 변경 없음');
        }
      }
    } catch {
      recordSync('failed');
      toast.error('동기화 실패 — 잠시 후 다시 시도해주세요');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      title={collapsed ? '동기화' : undefined}
      aria-label="동기화"
      className={cn(
        // 설정 Link와 동일한 시각 언어 — 무채색 유지, 스핀 중에도 색 추가 없음.
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'justify-center px-0' : '',
      )}
    >
      <RefreshCw className={cn('h-4 w-4 flex-shrink-0', syncing && 'animate-spin')} />
      {!collapsed && '동기화'}
    </button>
  );
}
