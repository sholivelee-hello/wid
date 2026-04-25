'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function QuickCaptureModal({ open, onOpenChange, onCreated }: QuickCaptureModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('보통');
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState('');
  const [requester, setRequester] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setPriority('보통');
    setShowMore(false);
    setDescription('');
    setRequester('');
    setDeadline('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.length < 2) {
      toast.error('제목을 2자 이상 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          status: '대기',
          source: 'manual',
          description: description || null,
          requester: requester || null,
          deadline: deadline || null,
        }),
      });
      toast.success('task가 등록되었습니다');
      reset();
      onOpenChange(false);
      onCreated?.();
      // Dispatch custom event for any listening page to refetch
      window.dispatchEvent(new CustomEvent('task-created'));
    } catch {
      // error toasted by apiFetch
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 task 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="quick-title">제목 *</Label>
            <Input
              id="quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="task 제목을 입력하세요"
              autoFocus
              required
            />
          </div>
          <div>
            <Label>우선순위</Label>
            <Select value={priority} onValueChange={(val) => { if (val) setPriority(val); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showMore && "rotate-180")} />
            추가 옵션
          </button>

          {showMore && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <Label htmlFor="quick-desc">설명</Label>
                <Textarea id="quick-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="quick-requester">요청자</Label>
                  <Input id="quick-requester" value={requester} onChange={(e) => setRequester(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="quick-deadline">마감일</Label>
                  <Input id="quick-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={saving}>{saving ? '등록 중...' : '등록'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
