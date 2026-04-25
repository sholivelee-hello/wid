'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, CalendarDays } from 'lucide-react';
import {
  getGCalConfig,
  setGCalConfig,
  expandCalendarIds,
  GCAL_EMBED_EVENT,
  DEFAULT_GCAL_CONFIG,
  type GCalConfig,
  type GCalDarkMode,
} from '@/lib/gcal-embed';

function configToText(c: GCalConfig): string {
  return c.calendars.join('\n');
}

export function GCalSettings() {
  const [config, setConfig] = useState<GCalConfig>(() => getGCalConfig());
  const [text, setText] = useState<string>(() => configToText(getGCalConfig()));

  useEffect(() => {
    const handler = () => {
      const next = getGCalConfig();
      setConfig(next);
      setText(configToText(next));
    };
    window.addEventListener(GCAL_EMBED_EVENT, handler);
    return () => window.removeEventListener(GCAL_EMBED_EVENT, handler);
  }, []);

  const expandedIds = expandCalendarIds(
    text.split('\n').map(s => s.trim()).filter(Boolean),
  );
  const isConnected = expandCalendarIds(config.calendars).length > 0;
  const dirty =
    text !== configToText(config); // calendars only — hour/dark save instantly

  const handleSaveCalendars = () => {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const next: GCalConfig = { ...config, calendars: lines };
    setGCalConfig(next);
    setConfig(next);
  };

  const handleClear = () => {
    const next: GCalConfig = { ...DEFAULT_GCAL_CONFIG };
    setGCalConfig(next);
    setConfig(next);
    setText('');
  };

  const updateField = <K extends keyof GCalConfig>(key: K, value: GCalConfig[K]) => {
    const next: GCalConfig = { ...config, [key]: value };
    setGCalConfig(next);
    setConfig(next);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Google Calendar 연동 (임베드)</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>
                {expandCalendarIds(config.calendars).length}개 캘린더 등록됨 — 캘린더 페이지에서 표시됩니다
              </span>
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">아직 캘린더가 등록되지 않았습니다</span>
            </>
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            캘린더 ID / 임베드 URL — 한 줄에 하나씩
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'example@gmail.com\nteam@group.calendar.google.com\nhttps://calendar.google.com/calendar/embed?src=…'}
            className="mt-1 font-mono text-xs min-h-[120px]"
          />
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
            본인 캘린더는 Google 캘린더 → 설정 (⚙) → 캘린더 통합에서 ID 복사. 구독 중인 다른 캘린더는
            <strong> 다른 캘린더</strong> 섹션에서 같은 위치에 ID가 있어요. 비공개 캘린더는 공유 설정에서
            공개로 만들거나 비공개 주소(iCal)를 써야 임베드에 보입니다. URL을 통째로 붙여넣으면 그 안의
            모든 <code>src=</code>가 자동 분리됩니다.
          </p>
          {expandedIds.length > 0 && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              감지된 캘린더 ID {expandedIds.length}개: {expandedIds.slice(0, 3).join(', ')}
              {expandedIds.length > 3 && ` 외 ${expandedIds.length - 3}개`}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" onClick={handleSaveCalendars} disabled={!dirty}>
              캘린더 저장
            </Button>
            {(config.calendars.length > 0 || text) && (
              <Button size="sm" variant="outline" onClick={handleClear}>
                전부 비우기
              </Button>
            )}
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-xs text-muted-foreground">표시 시간대</Label>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground/80">시작 (시)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={config.startHour}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  updateField('startHour', Math.max(0, Math.min(23, n)));
                }}
              />
            </div>
            <span className="text-muted-foreground pb-2">~</span>
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground/80">종료 (시)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={config.endHour}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  updateField('endHour', Math.max(1, Math.min(24, n)));
                }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            캘린더 페이지의 주(週) 모드에서 보이는 시간 범위. 변경 즉시 적용됩니다.
          </p>
        </div>

        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground">테마</Label>
          <Select
            value={config.darkMode}
            onValueChange={(v) => updateField('darkMode', v as GCalDarkMode)}
          >
            <SelectTrigger className="mt-1 max-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">자동 (시스템 따라)</SelectItem>
              <SelectItem value="light">라이트 고정</SelectItem>
              <SelectItem value="dark">다크 고정</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground/70 mt-1.5">
            Google 캘린더 임베드는 공식 다크 모드가 없어 색상 반전 필터로 표시됩니다.
            일부 색이 어색하게 보일 수 있습니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
