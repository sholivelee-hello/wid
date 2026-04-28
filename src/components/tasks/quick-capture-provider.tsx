'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskQuickCapture } from '@/components/tasks/task-quick-capture';
import { addTodayTask } from '@/lib/today-tasks';

interface QuickCaptureContextValue {
  registerInlineFocus: (fn: (() => void) | null) => void;
  openModal: () => void;
  closeModal: () => void;
}

const QuickCaptureCtx = createContext<QuickCaptureContextValue | null>(null);

export function useQuickCapture(): QuickCaptureContextValue {
  const ctx = useContext(QuickCaptureCtx);
  if (!ctx) throw new Error('useQuickCapture must be used inside QuickCaptureProvider');
  return ctx;
}

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const inlineFocusRef = useRef<(() => void) | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const pathname = usePathname();
  // Today-page semantics: any task captured while we're on /today should be
  // auto-included in today's list, whether the user typed inline or hit ⌘N
  // and used the global modal. Mirrors the Today inline composer's behavior
  // so the two entry points stay consistent.
  const isTodayPage = pathname === '/today';

  const registerInlineFocus = useCallback((fn: (() => void) | null) => {
    inlineFocusRef.current = fn;
  }, []);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'n') return;
      const target = e.target as HTMLElement | null;
      // Ignore if event originated inside the composer's own input
      if (target && (target as HTMLInputElement).dataset?.quickCaptureInput === 'true') return;

      e.preventDefault();
      // If modal already open, just refocus its input.
      if (modalOpen) {
        const input = document.querySelector<HTMLInputElement>(
          '[data-quick-capture-input="true"]',
        );
        input?.focus();
        return;
      }
      // Inbox page: focus inline composer.
      if (inlineFocusRef.current) {
        inlineFocusRef.current();
        return;
      }
      // Other pages: open modal.
      setModalOpen(true);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen]);

  return (
    <QuickCaptureCtx.Provider value={{ registerInlineFocus, openModal, closeModal }}>
      {children}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{isTodayPage ? '오늘 할 일 추가' : '새 task 추가'}</DialogTitle>
          </DialogHeader>
          {modalOpen && (
            <TaskQuickCapture
              surface="modal"
              autoFocus
              onCreated={(t) => {
                if (isTodayPage) addTodayTask(t.id);
              }}
              onSubmittedClose={() => setModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </QuickCaptureCtx.Provider>
  );
}
