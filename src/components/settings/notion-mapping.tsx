'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, HelpCircle, CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const LS_KEY = 'wid:notion:last-sync';
const LS_RESULT_KEY = 'wid:notion:last-sync-result';
const LS_HISTORY_KEY = 'wid:notion:history';
const HISTORY_MAX = 7;

type SyncResult = 'success' | 'failed';

type StatusState = 'connected' | 'failed' | 'stale' | 'never';

type HistoryEntry = { ts: number; result: SyncResult };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          e &&
          typeof e.ts === 'number' &&
          (e.result === 'success' || e.result === 'failed'),
      )
      .slice(-HISTORY_MAX);
  } catch {
    return [];
  }
}

function pushHistory(prev: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...prev, entry];
  while (next.length > HISTORY_MAX) next.shift();
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function getSyncStatus(date: Date | null, result: SyncResult | null): {
  pillClass: string;
  Icon: typeof CheckCircle2;
  label: string;
  state: StatusState;
} {
  if (!date || !result) {
    return {
      pillClass: 'bg-muted text-muted-foreground',
      Icon: MinusCircle,
      label: '미연결',
      state: 'never',
    };
  }
  if (result === 'failed') {
    return {
      pillClass: 'bg-red-500/10 text-red-700 dark:text-red-400',
      Icon: XCircle,
      label: '실패',
      state: 'failed',
    };
  }
  // result === 'success'
  const diffMs = Date.now() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diffMs > oneDay) {
    return {
      pillClass: 'bg-muted text-muted-foreground',
      Icon: Clock,
      label: '대기',
      state: 'stale',
    };
  }
  return {
    pillClass: 'bg-primary/10 text-primary',
    Icon: CheckCircle2,
    label: '정상',
    state: 'connected',
  };
}

function HistorySparkline({ history }: { history: HistoryEntry[] }) {
  // pad with empty slots on the left to always show 7 slots
  const empties = Math.max(0, HISTORY_MAX - history.length);
  return (
    <div className="flex items-center gap-1" aria-label="최근 7회 동기화 이력">
      {Array.from({ length: empties }).map((_, i) => (
        <span
          key={`e-${i}`}
          className="w-1.5 h-1.5 rounded-full bg-muted/40"
          aria-hidden="true"
        />
      ))}
      {history.map((h) => (
        <span
          key={h.ts}
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            h.result === 'success' ? 'bg-primary' : 'bg-red-500',
          )}
          title={`${format(new Date(h.ts), 'M월 d일 HH:mm', { locale: ko })} — ${
            h.result === 'success' ? '성공' : '실패'
          }`}
        />
      ))}
    </div>
  );
}

export function NotionMapping() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastSync(new Date(stored));
    const storedResult = localStorage.getItem(LS_RESULT_KEY);
    if (storedResult === 'success' || storedResult === 'failed') {
      setLastSyncResult(storedResult);
    }
    setHistory(loadHistory());
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const data = await apiFetch<{ created: number; updated: number; total: number }>(
        '/api/notion/sync',
        { method: 'POST' }
      );
      setSyncResult(data);
      const now = new Date();
      localStorage.setItem(LS_KEY, now.toISOString());
      localStorage.setItem(LS_RESULT_KEY, 'success');
      setLastSync(now);
      setLastSyncResult('success');
      setHistory((h) => pushHistory(h, { ts: now.getTime(), result: 'success' }));
    } catch {
      setSyncError('동기화 중 오류가 발생했습니다. NOTION_API_KEY와 DB ID를 확인해주세요.');
      const now = new Date();
      localStorage.setItem(LS_KEY, now.toISOString());
      localStorage.setItem(LS_RESULT_KEY, 'failed');
      setLastSync(now);
      setLastSyncResult('failed');
      setHistory((h) => pushHistory(h, { ts: now.getTime(), result: 'failed' }));
    } finally {
      setSyncing(false);
    }
  };

  const status = getSyncStatus(lastSync, lastSyncResult);
  const Icon = status.Icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Notion 연동</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                status.pillClass,
              )}
            >
              <Icon className="w-3 h-3" />
              {status.label}
            </span>
            {lastSync && (
              <span className="text-xs text-muted-foreground">
                · {formatDistanceToNow(lastSync, { locale: ko, addSuffix: true })}
              </span>
            )}
            <HistorySparkline history={history} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>• Notion DB 2개에서 담당자가 <strong className="text-foreground">이신희</strong>로 지정된 task를 자동으로 가져옵니다</p>
          <p>• 제목, 마감일, ISSUE 속성이 Notion 기준으로 업데이트됩니다</p>
          <p className="flex items-center gap-1">
            <span>• 동기화는 앱 시작 시 자동으로 실행됩니다</span>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="동기화 버튼 안내"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <PopoverContent side="top" className="w-72 text-sm">
                Notion API는 실시간 push를 지원하지 않아 앱에서 주기적으로 pull합니다. 아래 버튼으로 즉시 강제 동기화할 수 있습니다.
              </PopoverContent>
            </Popover>
          </p>
        </div>

        <div className="space-y-2">
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : 'Notion 동기화 실행'}
          </Button>
          {syncResult && (
            <p className="text-sm text-primary">
              완료 — {syncResult.total}건 확인, {syncResult.created}건 새로 가져옴, {syncResult.updated}건 업데이트
            </p>
          )}
          {syncError && (
            <p className="text-sm text-destructive">{syncError}</p>
          )}
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <p>필요한 환경변수:</p>
          <div className="flex flex-wrap gap-1.5">
            {['NOTION_API_KEY', 'NOTION_DATABASE_ID_1', 'NOTION_DATABASE_ID_2'].map(k => (
              <code key={k} className="bg-muted px-1.5 py-0.5 rounded">{k}</code>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
