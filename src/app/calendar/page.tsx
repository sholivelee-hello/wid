'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarDays, Settings as SettingsIcon } from 'lucide-react';
import { getGCalEmbedRaw, buildEmbedUrl, GCAL_EMBED_EVENT } from '@/lib/gcal-embed';

type Mode = 'WEEK' | 'MONTH' | 'AGENDA';

export default function CalendarPage() {
  const [raw, setRaw] = useState(() => getGCalEmbedRaw());
  const [mode, setMode] = useState<Mode>('WEEK');

  useEffect(() => {
    const handler = () => setRaw(getGCalEmbedRaw());
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  const embedUrl = buildEmbedUrl(raw, mode);

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          캘린더
        </h1>
        {embedUrl && (
          <div className="flex items-center gap-1">
            {(['WEEK', 'MONTH', 'AGENDA'] as Mode[]).map(m => (
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
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <iframe
            key={embedUrl}
            src={embedUrl}
            className="w-full h-[78vh] border-0"
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
    </div>
  );
}
