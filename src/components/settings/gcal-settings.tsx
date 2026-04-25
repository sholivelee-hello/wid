'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, CalendarDays, Trash2 } from 'lucide-react';
import {
  getGCalEmbedRaw,
  setGCalEmbedRaw,
  buildEmbedUrl,
  GCAL_EMBED_EVENT,
} from '@/lib/gcal-embed';

export function GCalSettings() {
  const [value, setValue] = useState(() => getGCalEmbedRaw());
  const [saved, setSaved] = useState(() => getGCalEmbedRaw());

  useEffect(() => {
    const handler = () => setSaved(getGCalEmbedRaw());
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  const previewUrl = buildEmbedUrl(value, 'WEEK');
  const isConnected = !!buildEmbedUrl(saved, 'WEEK');

  const handleSave = () => {
    setGCalEmbedRaw(value);
    setSaved(value);
  };

  const handleClear = () => {
    setGCalEmbedRaw('');
    setValue('');
    setSaved('');
  };

  return (
    <Card>
      <CardHeader><CardTitle>Google Calendar 연동 (임베드)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>임베드 URL 저장됨 — 캘린더 페이지에서 표시됩니다</span>
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">아직 임베드 URL이 등록되지 않았습니다</span>
            </>
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">캘린더 ID 또는 임베드 URL</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="example@gmail.com 또는 https://calendar.google.com/calendar/embed?src=…"
            className="mt-1 font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
            Google 캘린더 → 설정 (⚙) → 보고싶은 캘린더 선택 → <strong>캘린더 통합</strong> 섹션에서{' '}
            <strong>공개 URL</strong> 또는 <strong>이 캘린더 임베드</strong> 코드 안의 src 값을 복사해
            붙여넣으세요. 비공개 캘린더라면 캘린더 공유 설정에서 <em>공개</em>로 만들거나{' '}
            <em>비공개 주소(iCal)</em>를 사용해야 합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={value === saved}>
            저장
          </Button>
          {saved && (
            <Button size="sm" variant="outline" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> 연결 해제
            </Button>
          )}
        </div>

        {previewUrl && value !== saved && (
          <div className="rounded border border-border/40 bg-muted/30 p-2 text-[11px] text-muted-foreground">
            미리보기 URL: <span className="font-mono break-all">{previewUrl}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
