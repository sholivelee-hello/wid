'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  CalendarDays,
  Loader2,
  Clock,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  getGCalConfig,
  setGCalConfig,
  getCalendarColor,
  GCAL_EMBED_EVENT,
  DEFAULT_GCAL_CONFIG,
  type GCalConfig,
} from '@/lib/gcal-embed';
import { isGoogleOAuthConfigured, ensureFreshOAuth } from '@/lib/gcal-oauth';
import { fetchSubscribedCalendars } from '@/lib/gcal-api';

type LoadingState = 'idle' | 'auth' | 'fetch' | 'revoke';

type GCalStatusState = 'connected' | 'failed' | 'stale' | 'never';

type FetchResult = 'success' | 'failed';

type HistoryEntry = { ts: number; result: FetchResult };

const LS_LAST_FETCH = 'wid:gcal:last-fetch';
const LS_LAST_RESULT = 'wid:gcal:last-fetch-result';
const LS_HISTORY_KEY = 'wid:gcal:history';
const HISTORY_MAX = 7;

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

function getGCalStatus(
  oauthConfigured: boolean,
  isSignedIn: boolean,
  activeCount: number,
): {
  pillClass: string;
  Icon: typeof CheckCircle2;
  label: string;
  state: GCalStatusState;
} {
  if (!oauthConfigured) {
    return {
      pillClass: 'bg-muted text-muted-foreground',
      Icon: MinusCircle,
      label: '미연결',
      state: 'never',
    };
  }
  if (!isSignedIn) {
    return {
      pillClass: 'bg-muted text-muted-foreground',
      Icon: MinusCircle,
      label: '미연결',
      state: 'never',
    };
  }
  if (activeCount === 0) {
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
    <div className="flex items-center gap-1" aria-label="최근 7회 캘린더 조회 이력">
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

export function GCalSettings() {
  // SSR/hydration mismatch 방지: 서버는 DEFAULT, 클라는 localStorage값을 쓰면
  // 첫 렌더에서 status icon이 달라진다. 초기값은 DEFAULT로 통일하고 마운트
  // 직후 useEffect에서 실제 값을 채운다.
  const [config, setConfig] = useState<GCalConfig>(DEFAULT_GCAL_CONFIG);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setConfig(getGCalConfig());
    const handler = () => setConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  // OAuth redirect 복귀 처리(?gcal=connected|error) + 서버 연동 상태 동기화.
  // 연동 직후 캘린더 목록이 비어 있으면 자동으로 한 번 가져온다 — 사용자가
  // "구독 목록 새로고침"을 따로 누를 필요 없게.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('gcal');
    if (flag) {
      if (flag === 'connected') {
        toast.success('Google 계정 연동 완료 — 이제 자동으로 유지돼요');
      } else {
        toast.error(`Google 연동 실패: ${params.get('reason') ?? '알 수 없는 오류'}`);
      }
      params.delete('gcal');
      params.delete('reason');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }

    let cancelled = false;
    (async () => {
      const oauth = await ensureFreshOAuth();
      if (cancelled || !oauth) return;
      const current = getGCalConfig();
      setConfig(current);
      if (current.subscribedCalendars.length === 0) {
        setLoading('fetch');
        try {
          const subscribedCalendars = await fetchSubscribedCalendars(oauth.accessToken);
          if (cancelled) return;
          const next: GCalConfig = { ...getGCalConfig(), subscribedCalendars };
          setGCalConfig(next);
          setConfig(next);
          recordFetch('success');
        } catch {
          if (!cancelled) recordFetch('failed');
        } finally {
          if (!cancelled) setLoading('idle');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LS_LAST_FETCH);
    if (stored) {
      const ts = Number(stored);
      if (Number.isFinite(ts)) setLastFetch(new Date(ts));
    }
    setHistory(loadHistory());
  }, []);

  const oauthConfigured = isGoogleOAuthConfigured();
  // 서버가 refresh_token으로 자동 갱신하므로 로컬 만료는 "끊김"이 아니다 —
  // oauth 존재 여부만 본다 (만료분은 마운트 시 ensureFreshOAuth가 채움).
  const isSignedIn = !!config.oauth;
  const disabledSet = new Set(config.disabled);
  const activeCount = config.subscribedCalendars.filter(c => !disabledSet.has(c.id)).length;
  const gcalStatus = getGCalStatus(oauthConfigured, isSignedIn, activeCount);
  const StatusIcon = gcalStatus.Icon;

  const recordFetch = (result: FetchResult) => {
    const ts = Date.now();
    localStorage.setItem(LS_LAST_FETCH, ts.toString());
    localStorage.setItem(LS_LAST_RESULT, result);
    setLastFetch(new Date(ts));
    setHistory((h) => pushHistory(h, { ts, result }));
  };

  const toggleCalendar = (id: string, on: boolean) => {
    const set = new Set(config.disabled);
    if (on) set.delete(id); else set.add(id);
    const next: GCalConfig = { ...config, disabled: Array.from(set) };
    setGCalConfig(next);
    setConfig(next);
    const cal = config.subscribedCalendars.find(c => c.id === id);
    const name = cal?.summary || id;
    if (on) {
      toast.success(`${name} 표시됨 (히스토리에 포함)`);
    } else {
      toast(`${name} 표시 OFF (히스토리에서 제외)`);
    }
  };

  const handleSignIn = () => {
    setError(null);
    setLoading('auth');
    // 서버 주도 Authorization Code flow — 구글 동의 후 /settings로 복귀한다.
    window.location.href = '/api/gcal/oauth/start';
  };

  const handleRefreshCalendars = async () => {
    setError(null);
    setLoading('fetch');
    try {
      const oauth = await ensureFreshOAuth();
      if (!oauth) throw new Error('연동이 필요해요');
      const subscribedCalendars = await fetchSubscribedCalendars(oauth.accessToken);
      const next: GCalConfig = { ...config, subscribedCalendars };
      setGCalConfig(next);
      setConfig(next);
      recordFetch('success');
      toast.success('구독 목록 새로고침 완료');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(msg);
      recordFetch('failed');
      toast.error(`구독 목록 조회 실패: ${msg}`);
    } finally {
      setLoading('idle');
    }
  };

  const handleRevoke = async () => {
    setError(null);
    setLoading('revoke');
    try {
      const res = await fetch('/api/gcal/disconnect', { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? '서버 오류');
      const next: GCalConfig = { oauth: null, subscribedCalendars: [], disabled: [] };
      setGCalConfig(next);
      setConfig(next);
      toast.success('Google 계정 연결 해제됨');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(msg);
      toast.error(`연결 해제 실패: ${msg}`);
    } finally {
      setLoading('idle');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Google Calendar 연동</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                gcalStatus.pillClass,
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {gcalStatus.label}
            </span>
            {lastFetch && (
              <span className="text-xs text-muted-foreground">
                · {formatDistanceToNow(lastFetch, { locale: ko, addSuffix: true })}
              </span>
            )}
            <HistorySparkline history={history} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {!oauthConfigured ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Google OAuth가 설정되지 않았습니다.{' '}
              <code className="text-xs bg-muted px-1 rounded">.env.local</code>에{' '}
              <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>와{' '}
              <code className="text-xs bg-muted px-1 rounded">GOOGLE_CLIENT_SECRET</code>을
              추가하면 구독 중인 캘린더 목록을 자동으로 가져올 수 있어요.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              현재는 mock 데이터로 표시 중입니다. .env.local 설정 후 페이지를 새로고침하면 실제 캘린더가 연동됩니다.
            </p>
          </div>
        ) : isSignedIn ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>연동됨: {config.oauth?.email ?? '(이메일 없음)'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeCount} / {config.subscribedCalendars.length}개 캘린더에서 일정을 가져옵니다 — 아래에서 켜고 끌 수 있어요.
            </p>

            {config.subscribedCalendars.length > 0 && (
              <div className="border rounded-md max-h-72 overflow-y-auto">
                <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">색상은 히스토리 페이지의 일정 표시에 사용됩니다.</p>
                <ul className="divide-y">
                  {config.subscribedCalendars.map(cal => {
                    const checked = !disabledSet.has(cal.id);
                    const color = getCalendarColor(cal.id, config);
                    return (
                      <li key={cal.id}>
                        <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/30">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleCalendar(cal.id, e.target.checked)}
                            className="h-4 w-4 rounded border-input accent-primary cursor-pointer flex-shrink-0"
                          />
                          <span
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color, opacity: checked ? 1 : 0.3 }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={
                                'block text-sm leading-tight truncate ' +
                                (checked ? '' : 'text-muted-foreground line-through')
                              }
                            >
                              {cal.summary || cal.id}
                              {cal.primary && (
                                <span className="ml-1.5 text-xs text-muted-foreground">(기본)</span>
                              )}
                            </span>
                            {cal.summary && cal.summary !== cal.id && (
                              <span className="block text-xs text-muted-foreground/70 truncate mt-0.5">
                                {cal.id}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshCalendars}
                disabled={loading !== 'idle'}
              >
                {loading === 'fetch' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                구독 목록 새로고침
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRevoke}
                disabled={loading !== 'idle'}
              >
                {loading === 'revoke' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                연결 해제
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>Google 계정으로 한 번만 로그인하면 연동이 계속 유지돼요. 구독 중인 캘린더 목록도 자동으로 가져옵니다.</span>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              size="sm"
              onClick={handleSignIn}
              disabled={loading !== 'idle'}
            >
              {(loading === 'auth' || loading === 'fetch') && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              )}
              Google 계정으로 로그인
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
