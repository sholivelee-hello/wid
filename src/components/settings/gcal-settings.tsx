'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CalendarDays } from 'lucide-react';

export function GCalSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>Google Calendar 연동</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>연결됨 (데모 모드 — 모의 일정 표시)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          주별 대시보드의 날짜 선택 달력에 Google Calendar 일정이 표시됩니다.
          실제 연동은 OAuth 인증 후 활성화됩니다.
        </p>
        <Button variant="outline" size="sm" disabled className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Google Calendar에 로그인 (준비 중)
        </Button>
      </CardContent>
    </Card>
  );
}
