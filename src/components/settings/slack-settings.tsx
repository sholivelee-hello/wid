'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export function SlackSettings() {
  const triggerEmoji = process.env.NEXT_PUBLIC_SLACK_TRIGGER_EMOJI ?? 'eyes';
  const completeEmoji = process.env.NEXT_PUBLIC_SLACK_COMPLETE_EMOJI ?? 'white_check_mark';
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/slack/webhook` : '/api/slack/webhook';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Slack 연동</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-2">
          <p><strong>트리거 이모지:</strong> <code>:{triggerEmoji}:</code></p>
          <p><strong>완료 이모지:</strong> <code>:{completeEmoji}:</code></p>
          <p className="text-muted-foreground">
            슬랙에서 가져온 task의 원본 메시지에 완료 이모지를 추가하면, WID에서 자동으로 완료 처리됩니다.
          </p>
          <div className="flex items-center gap-2">
            <p><strong>웹훅 URL:</strong> <code>{webhookUrl}</code></p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-muted-foreground">
            Slack App 설정에서 Event Subscriptions의 Request URL에 위 웹훅 URL을 등록하고,
            Subscribe to bot events에 <code>reaction_added</code>를 추가하세요.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
