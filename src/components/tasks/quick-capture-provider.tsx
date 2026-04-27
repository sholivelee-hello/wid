'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskQuickCapture } from '@/components/tasks/task-quick-capture';

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
            <DialogTitle>새 task 추가</DialogTitle>
          </DialogHeader>
          {modalOpen && (
            <TaskQuickCapture
              surface="modal"
              autoFocus
              onSubmittedClose={() => setModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </QuickCaptureCtx.Provider>
  );
}
