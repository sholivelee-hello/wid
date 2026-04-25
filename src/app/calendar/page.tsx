'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { CalendarDays, Settings as SettingsIcon } from 'lucide-react';
import {
  getGCalConfig,
  buildEmbedUrl,
  GCAL_EMBED_EVENT,
  type CalendarMode,
  type GCalConfig,
} from '@/lib/gcal-embed';

const PX_PER_HOUR = 60; // tuning constant for the WEEK-mode iframe crop

export default function CalendarPage() {
  const [config, setConfig] = useState<GCalConfig>(() => getGCalConfig());
  const [mode, setMode] = useState<CalendarMode>('WEEK');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const handler = () => setConfig(getGCalConfig());
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  const useDark =
    config.darkMode === 'dark' ||
    (config.darkMode === 'auto' && resolvedTheme === 'dark');

  const embedUrl = buildEmbedUrl(config, {
    mode,
    bgColor: useDark ? '#0b0b0c' : undefined,
  });

  // Time-of-day crop only applies in WEEK mode where Google renders a
  // 24-hour vertical grid we can offset.
  const cropEnabled = mode === 'WEEK' && config.endHour > config.startHour;
  const visibleHours = cropEnabled ? config.endHour - config.startHour : 24;
  const wrapperHeight = visibleHours * PX_PER_HOUR;
  const iframeHeight = 24 * PX_PER_HOUR;
  const iframeMarginTop = cropEnabled ? -config.startHour * PX_PER_HOUR : 0;

  // Dark mode: invert + hue-rotate makes the iframe look dark without messing
  // up the event hue too badly. Color is approximate, not perfect.
  const darkFilter = useDark ? 'invert(0.92) hue-rotate(180deg)' : undefined;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          캘린더
        </h1>
        {embedUrl && (
          <div className="flex items-center gap-1">
            {(['WEEK', 'MONTH', 'AGENDA'] as CalendarMode[]).map(m => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode(m)}
                className="h-7 text-xs"
              >
                {m === 'WEEK' ? '주' : m === 'MONTH' ? '월' : '일정'}
              </Button>
            ))}
          </div>
        )}
      </div>

      {embedUrl ? (
        <div
          className="rounded-lg border border-border/60 bg-card overflow-hidden"
          style={{ height: wrapperHeight, maxHeight: '82vh' }}
        >
          <iframe
            key={`${embedUrl}|${useDark ? 'dark' : 'light'}`}
            src={embedUrl}
            className="w-full border-0 block"
            style={{
              height: cropEnabled ? iframeHeight : '100%',
              marginTop: iframeMarginTop,
              filter: darkFilter,
            }}
            title="Google Calendar"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-10 text-center space-y-4">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">아직 Google 캘린더가 연결되지 않았습니다</p>
            <p className="text-xs text-muted-foreground mt-1">
              설정 페이지에서 캘린더 ID 또는 임베드 URL을 등록하면 여기에 임베드됩니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings#gcal">
              <SettingsIcon className="h-4 w-4 mr-1.5" /> 설정으로 이동
            </Link>
          </Button>
        </div>
      )}

      {embedUrl && cropEnabled && (
        <p className="text-[11px] text-muted-foreground/70">
          {config.startHour}:00 – {config.endHour}:00 시간대만 표시 중. 설정에서 범위를 조절할 수 있어요.
          {useDark && ' · 다크 모드는 색상 반전 필터로 적용된 비공식 표시입니다.'}
        </p>
      )}
    </div>
  );
}
