'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
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

export function SlackSettings() {
  const triggerEmoji = process.env.NEXT_PUBLIC_SLACK_TRIGGER_EMOJI ?? 'send-away';
  const completeEmoji = process.env.NEXT_PUBLIC_SLACK_COMPLETE_EMOJI ?? '완료';
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/slack/webhook` : '/api/slack/webhook';
  const [copied, setCopied] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [lastPingResult, setLastPingResult] = useState<PingResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastPing(new Date(stored));
    const storedResult = localStorage.getItem(LS_RESULT_KEY);
    if (storedResult === 'success' || storedResult === 'failed') {
      setLastPingResult(storedResult);
    }
    setHistory(loadHistory());
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      const res = await fetch('/api/slack/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, message: 'WID test ping' }),
      });
      if (res.ok) {
        toast.success('테스트 전송 성공');
        recordResult('success');
      } else {
        toast.error(`테스트 전송 실패: ${res.status}`);
        recordResult('failed');
      }
    } catch {
      toast.error('테스트 전송 실패: 네트워크 오류');
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
        <div className="text-sm space-y-2">
          <p><strong>트리거 이모지:</strong> <code>:{triggerEmoji}:</code></p>
          <p><strong>완료 이모지:</strong> <code>:{completeEmoji}:</code></p>
          <p className="text-muted-foreground">
            슬랙에서 가져온 task의 원본 메시지에 완료 이모지를 추가하면, WID에서 자동으로 완료 처리됩니다.
          </p>
          <div className="space-y-1.5">
            <p><strong>웹훅 URL:</strong></p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5">
              <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{webhookUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
                aria-label="웹훅 URL 복사"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Slack App 설정에서 Event Subscriptions의 Request URL에 위 웹훅 URL을 등록하고,
            Subscribe to bot events에 <code>reaction_added</code>를 추가하세요.
          </p>
        </div>
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={handlePing} disabled={pinging}>
            <Send className={`h-3.5 w-3.5 mr-1.5 ${pinging ? 'animate-pulse' : ''}`} />
            {pinging ? '전송 중...' : '테스트 전송'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
