'use client';

import { useEffect, useState, useCallback } from 'react';
import { NotionStatusMapping } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function NotionMapping() {
  const [mappings, setMappings] = useState<NotionStatusMapping[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchMappings = useCallback(async () => {
    try {
      const data = await apiFetch<NotionStatusMapping[]>('/api/settings/notion-mapping');
      setMappings(data);
    } catch {
      // error already toasted by apiFetch
    }
  }, []);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  const handleSave = async () => {
    const valid = mappings.filter(m => m.notion_status.trim() && m.wid_status.trim());
    const invalid = mappings.length - valid.length;
    if (invalid > 0) {
      toast.error(`${invalid}개의 매핑이 불완전합니다. Notion 상태와 WID 상태를 모두 입력해주세요.`);
      return;
    }
    try {
      await apiFetch('/api/settings/notion-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: valid.map((m) => ({ notion_status: m.notion_status, wid_status: m.wid_status })),
        }),
      });
      toast.success('매핑이 저장되었습니다');
    } catch {
      // error already toasted by apiFetch
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await apiFetch<{ created: number; updated: number; total: number }>('/api/notion/sync', { method: 'POST' });
      setSyncResult(`동기화 완료: ${data.created}건 생성, ${data.updated}건 업데이트 (총 ${data.total}건)`);
    } catch {
      // error already toasted by apiFetch
    } finally {
      setSyncing(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { id: crypto.randomUUID(), notion_status: '', wid_status: '대기' }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, key: 'notion_status' | 'wid_status', value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [key]: value };
    setMappings(updated);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Notion 연동</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">상태 매핑 (Notion 상태 → WID 상태)</p>
          <div className="space-y-2">
            {mappings.map((m, i) => (
              <div key={m.id} className="flex gap-2 items-start">
                <div className="flex flex-col gap-1 w-40">
                  <Input
                    placeholder="Notion 상태"
                    value={m.notion_status}
                    onChange={(e) => updateMapping(i, 'notion_status', e.target.value)}
                    className={cn(!m.notion_status.trim() && "border-destructive/50")}
                    aria-invalid={!m.notion_status.trim()}
                  />
                  {!m.notion_status.trim() && (
                    <p className="text-[10px] text-destructive/80 px-1">필수 입력</p>
                  )}
                </div>
                <span className="text-muted-foreground/70 mt-2">→</span>
                <div className="flex flex-col gap-1 w-40">
                  <Input
                    placeholder="WID 상태"
                    value={m.wid_status}
                    onChange={(e) => updateMapping(i, 'wid_status', e.target.value)}
                    className={cn(!m.wid_status.trim() && "border-destructive/50")}
                    aria-invalid={!m.wid_status.trim()}
                  />
                  {!m.wid_status.trim() && (
                    <p className="text-[10px] text-destructive/80 px-1">필수 입력</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => removeMapping(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-4 w-4 mr-1" />매핑 추가
            </Button>
            <Button size="sm" onClick={handleSave}>저장</Button>
          </div>
        </div>
        <div className="pt-4 border-t">
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : 'Notion 동기화 실행'}
          </Button>
          {syncResult && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">{syncResult}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
