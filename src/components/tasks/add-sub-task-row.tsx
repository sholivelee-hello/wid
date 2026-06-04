'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { addTodayTask } from '@/lib/today-tasks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Task } from '@/lib/types';

/**
 * 하위 task 인라인 추가 입력. task-branch의 hover 버튼과 TaskCard 우클릭
 * "하위 task 추가" 메뉴가 공유한다 (task-branch에서 추출 — 2026-06-04).
 *
 * 생성 성공 시 `task-created` 이벤트를 broadcast — 전체/오늘/이슈 상세
 * 페이지가 모두 이 이벤트로 목록을 새로고침한다.
 */
export function AddSubTaskRow({
  parentId,
  addToToday = false,
  startOpen = false,
  onClose,
}: {
  parentId: string;
  addToToday?: boolean;
  /** true면 "+ 하위 task 추가" 버튼 단계 없이 입력창이 바로 열린다
   *  (우클릭 메뉴 진입용). */
  startOpen?: boolean;
  /** 입력창이 닫힐 때(추가 완료 또는 취소) 호출 — startOpen 소유자의 상태 정리용. */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setTitle('');
    onClose?.();
  };

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      // Append after the parent's existing sub-tasks. Server defaults to 0,
      // which would stack new sub-tasks at the top — opposite of what users
      // expect for a checklist.
      let nextPosition = 0;
      try {
        const siblings = await apiFetch<Task[]>(
          `/api/tasks?parent_task_id=${parentId}&deleted=false`,
          { suppressToast: true },
        );
        nextPosition = siblings.reduce((m, s) => Math.max(m, s.position), -1) + 1;
      } catch {
        // Fall through with position 0 — visual order is the only casualty.
      }
      const created = await apiFetch<{ id: string }>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Explicit status — without this the mock-backend default used to
        // create tasks with a status outside TASK_STATUSES, which then got
        // silently filtered out of the Today page's status groups.
        body: JSON.stringify({ title: t, parent_task_id: parentId, issue_id: null, status: '등록', position: nextPosition }),
        suppressToast: true,
      });
      if (addToToday && created?.id) addTodayTask(created.id);
      window.dispatchEvent(new CustomEvent('task-created'));
      close();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent/40"
      >
        <Plus className="h-3 w-3" /> 하위 task 추가
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') { e.preventDefault(); close(); }
        }}
        placeholder="하위 task 제목"
        className="h-7 text-xs"
      />
      <Button type="button" size="sm" onClick={submit} disabled={!title.trim() || busy} className="h-7 text-xs">
        추가
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={close}
        className="h-7 text-xs"
      >
        취소
      </Button>
    </div>
  );
}
