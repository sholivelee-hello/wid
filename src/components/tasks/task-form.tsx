'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES, DEFAULT_STATUSES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';
import { Task } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface TaskFormProps {
  task?: Task;
  customStatuses?: string[];
}

export function TaskForm({ task, customStatuses = [] }: TaskFormProps) {
  const router = useRouter();
  const isEdit = !!task;
  const hiddenStatuses = useHiddenStatuses();
  const allStatuses = [...DEFAULT_STATUSES.filter(s => !hiddenStatuses.has(s)), ...customStatuses];

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? '보통',
    status: task?.status ?? '대기',
    requester: task?.requester ?? '',
    requested_at: task?.requested_at?.slice(0, 10) ?? '',
    deadline: task?.deadline?.slice(0, 10) ?? '',
    delegate_to: task?.delegate_to ?? '',
    follow_up_note: task?.follow_up_note ?? '',
    actual_duration: task?.actual_duration?.toString() ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (form.title.length < 2) {
      newErrors.title = '제목은 2자 이상 입력해주세요';
    }
    if (form.actual_duration && parseInt(form.actual_duration) <= 0) {
      newErrors.actual_duration = '소요시간은 양수여야 합니다';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status: form.status,
      requester: form.requester || null,
      requested_at: form.requested_at || null,
      deadline: form.deadline || null,
    };

    if (isEdit) {
      payload.delegate_to = form.delegate_to || null;
      payload.follow_up_note = form.follow_up_note || null;
      if (form.actual_duration) {
        payload.actual_duration = parseInt(form.actual_duration);
        payload.is_duration_manual = true;
      }
    }

    const url = isEdit ? `/api/tasks/${task.id}` : '/api/tasks';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.success(isEdit ? 'task가 수정되었습니다' : 'task가 등록되었습니다');
      router.push(isEdit ? `/tasks/${task.id}` : '/tasks');
      router.refresh();
    } catch {
      // error already toasted by apiFetch
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <fieldset disabled={saving} className="space-y-4">
      <div>
        <Label htmlFor="title">제목 *</Label>
        <Input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} required />
        {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
      </div>
      <div>
        <Label htmlFor="description">설명</Label>
        <Textarea id="description" value={form.description} onChange={(e) => update('description', e.target.value)} />
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">분류</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>우선순위</Label>
          <Select value={form.priority} onValueChange={(v) => update('priority', v ?? '보통')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>상태</Label>
          <Select value={form.status} onValueChange={(v) => update('status', v ?? '대기')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="requester">요청자</Label>
          <Input id="requester" value={form.requester} onChange={(e) => update('requester', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="requested_at">요청일</Label>
          <Input id="requested_at" type="date" value={form.requested_at} onChange={(e) => update('requested_at', e.target.value)} />
        </div>
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">일정</p>
      <div>
        <Label htmlFor="deadline">마감일</Label>
        <Input id="deadline" type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
      </div>
      {isEdit && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">추가 정보</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delegate_to">위임 대상</Label>
              <Input id="delegate_to" value={form.delegate_to} onChange={(e) => update('delegate_to', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="actual_duration">소요시간 (분)</Label>
              <Input id="actual_duration" type="number" value={form.actual_duration} onChange={(e) => update('actual_duration', e.target.value)} />
              {errors.actual_duration && <p className="text-sm text-destructive mt-1">{errors.actual_duration}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="follow_up_note">후속 작업 메모</Label>
            <Textarea id="follow_up_note" value={form.follow_up_note} onChange={(e) => update('follow_up_note', e.target.value)} />
          </div>
        </>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
