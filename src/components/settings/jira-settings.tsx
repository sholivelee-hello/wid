'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, MinusCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface InboundState {
  lastEventAt: string | null;
  count24h: number;
  /** 응답 수신 시각 — 렌더 중 Date.now() 호출(불순 함수) 회피용 기준점. */
  fetchedAt: number;
}

// JIRA 연동은 인바운드 전용(시스템 웹훅 수신만)이라 슬랙처럼 outbound
// "연결 확인" 핑이 없다. jira_events 도달 기록이 곧 연동 상태다.
export function JiraSettings() {
  const [inbound, setInbound] = useState<InboundState | null>(null);

  useEffect(() => {
    fetch('/api/jira/inbound-status')
      .then((r) => r.json())
      .then((data: { ok: boolean; lastEventAt?: string | null; count24h?: number }) => {
        if (!data.ok) return;
        setInbound({
          lastEventAt: data.lastEventAt ?? null,
          count24h: data.count24h ?? 0,
          fetchedAt: Date.now(),
        });
      })
      .catch(() => {});
  }, []);

  const last = inbound?.lastEventAt ? new Date(inbound.lastEventAt) : null;
  const within24h =
    last && inbound ? inbound.fetchedAt - last.getTime() < 24 * 60 * 60 * 1000 : false;

  let pillClass: string;
  let Icon: typeof CheckCircle2;
  let label: string;
  if (inbound === null) {
    pillClass = 'bg-muted text-muted-foreground';
    Icon = Clock;
    label = '확인 중';
  } else if (!last) {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>JIRA 연동</CardTitle>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
              pillClass,
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-1.5">
          <p className="text-muted-foreground">
            JIRA 알림 3종이 자동으로 task가 돼요 — ① 나에게 새로 할당 ② 댓글에서
            나를 멘션 ③ 내가 담당자인 이슈에 새 댓글. 내가 직접 한 행동은
            만들지 않아요.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-12 shrink-0">수신</span>
          <span className="text-muted-foreground">
            {last
              ? `최근: ${formatDistanceToNow(last, { locale: ko, addSuffix: true })} · 최근 24h ${inbound?.count24h ?? 0}건`
              : 'JIRA가 아직 이 서버에 webhook을 보낸 적이 없어요. JIRA 설정 → 시스템 → 웹후크 등록을 확인하세요.'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
