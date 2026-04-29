'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const LS_KEY = 'wid:slack:last-ping';
const LS_RESULT_KEY = 'wid:slack:last-ping-result';
const LS_HISTORY_KEY = 'wid:slack:history';
const HISTORY_MAX = 7;

type PingResult = 'success' | 'failed';

type StatusState = 'connected' | 'failed' | 'stale' | 'never';

type HistoryEntry = { ts: number; result: PingResult };

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

function getPingStatus(date: Date | null, result: PingResult | null): {
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

function InboundStatusRow({ inbound }: { inbound: { lastEventAt: string | null; count24h: number } | null }) {
  if (inbound === null) {
    return (
      <div className="text-xs text-muted-foreground">수신 상태 확인 중…</div>
    );
  }

  const last = inbound.lastEventAt ? new Date(inbound.lastEventAt) : null;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const within24h = last ? Date.now() - last.getTime() < oneDayMs : false;

  let pillClass: string;
  let Icon: typeof CheckCircle2;
  let label: string;
  if (!last) {
    pillClass = 'bg-muted text-muted-foreground';
    Icon = MinusCircle;
    label = '도달 없음';
  } else if (within24h) {
    pillClass = 'bg-primary/10 text-primary';
    Icon = CheckCircle2;
    label = '도달';
  } else {
    pillClass = 'bg-muted text-muted-foreground';
    Icon = Clock;
    label = '대기';
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">수신</span>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
          pillClass,
        )}
      >
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="text-muted-foreground">
        {last
          ? `최근: ${formatDistanceToNow(last, { locale: ko, addSuffix: true })} · 최근 24h ${inbound.count24h}건`
          : '슬랙이 이 서버에 webhook을 보낸 적이 없어요. cloudflared 터널과 Slack App Request URL을 확인하세요.'}
      </span>
    </div>
  );
}

function HistorySparkline({ history }: { history: HistoryEntry[] }) {
  const empties = Math.max(0, HISTORY_MAX - history.length);
  return (
    <div className="flex items-center gap-1" aria-label="최근 7회 핑 이력">
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

interface InboundState {
  lastEventAt: string | null;
  count24h: number;
}

export function SlackSettings() {
  const triggerEmoji = process.env.NEXT_PUBLIC_SLACK_TRIGGER_EMOJI ?? 'send-away';
  const [pinging, setPinging] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [lastPingResult, setLastPingResult] = useState<PingResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inbound, setInbound] = useState<InboundState | null>(null);

  const refreshInbound = () => {
    fetch('/api/slack/inbound-status')
      .then((r) => r.json())
      .then((data: { ok: boolean; lastEventAt?: string | null; count24h?: number }) => {
        if (!data.ok) return;
        setInbound({
          lastEventAt: data.lastEventAt ?? null,
          count24h: data.count24h ?? 0,
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastPing(new Date(stored));
    const storedResult = localStorage.getItem(LS_RESULT_KEY);
    if (storedResult === 'success' || storedResult === 'failed') {
      setLastPingResult(storedResult);
    }
    setHistory(loadHistory());

    // 마운트 시 자동으로 한 번 연결 확인. 사용자가 버튼 누르기 전에도
    // 정확한 상태를 보여주기 위해. 결과는 그대로 핑 이력에 누적된다.
    let cancelled = false;
    fetch('/api/slack/test')
      .then((r) => r.json())
      .then((data: { ok: boolean }) => {
        if (cancelled) return;
        recordResult(data.ok ? 'success' : 'failed');
      })
      .catch(() => {
        if (cancelled) return;
        recordResult('failed');
      });

    refreshInbound();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordResult = (result: PingResult) => {
    const now = new Date();
    localStorage.setItem(LS_KEY, now.toISOString());
    localStorage.setItem(LS_RESULT_KEY, result);
    setLastPing(now);
    setLastPingResult(result);
    setHistory((h) => pushHistory(h, { ts: now.getTime(), result }));
  };

  const handlePing = async () => {
    setPinging(true);
    try {
      const res = await fetch('/api/slack/test');
      const data = (await res.json()) as { ok: boolean; team?: string; bot?: string; error?: string };
      if (data.ok) {
        toast.success(`Slack 연결됨${data.team ? ` · ${data.team}` : ''}${data.bot ? ` (@${data.bot})` : ''}`);
        recordResult('success');
      } else {
        toast.error(`Slack 연결 실패: ${data.error ?? '알 수 없음'}`);
        recordResult('failed');
      }
    } catch {
      toast.error('Slack 연결 실패: 네트워크 오류');
      recordResult('failed');
    } finally {
      setPinging(false);
    }
  };

  const status = getPingStatus(lastPing, lastPingResult);
  const Icon = status.Icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Slack 연동</CardTitle>
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
            {lastPing && (
              <span className="text-xs text-muted-foreground">
                · {formatDistanceToNow(lastPing, { locale: ko, addSuffix: true })}
              </span>
            )}
            <HistorySparkline history={history} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-1.5">
          <p>
            <strong>트리거 이모지:</strong> <code>:{triggerEmoji}:</code>
          </p>
          <p className="text-muted-foreground">
            슬랙 메시지에 위 이모지를 달면 WID 인박스에 자동으로 task가 만들어져요.
          </p>
        </div>
        <InboundStatusRow inbound={inbound} />
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handlePing();
              refreshInbound();
            }}
            disabled={pinging}
          >
            <Send className={`h-3.5 w-3.5 mr-1.5 ${pinging ? 'animate-pulse' : ''}`} />
            {pinging ? '확인 중...' : '연결 확인'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
