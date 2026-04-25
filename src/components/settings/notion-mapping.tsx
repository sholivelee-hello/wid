'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function NotionMapping() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    } catch {
      setSyncError('동기화 중 오류가 발생했습니다. NOTION_API_KEY와 DB ID를 확인해주세요.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Notion 연동</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>• Notion DB 2개에서 담당자가 <strong className="text-foreground">이신희</strong>로 지정된 task를 자동으로 가져옵니다</p>
          <p>• 제목, 마감일, ISSUE 속성이 Notion 기준으로 업데이트됩니다</p>
          <p>• <strong className="text-foreground/70">왜 버튼이 있나요?</strong> Notion API는 실시간 push를 지원하지 않아 앱에서 주기적으로 pull합니다. 앱 시작 시 자동 동기화되며, 이 버튼으로 즉시 강제 동기화할 수 있습니다</p>
        </div>

        <div className="space-y-2">
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : 'Notion 동기화 실행'}
          </Button>
          {syncResult && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
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
