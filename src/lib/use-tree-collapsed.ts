'use client';

import { useCallback, useState } from 'react';

const KEY = (kind: 'issue' | 'task', id: string) => `wid:collapsed:${kind}:${id}`;

function readInitial(kind: 'issue' | 'task', id: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(KEY(kind, id));
    if (v == null) return fallback;
    return v === '1';
  } catch {
    return fallback;
  }
}

export function useCollapsed(
  kind: 'issue' | 'task',
  id: string,
  defaultCollapsed = false,
  forceOpen = false,
) {
  const [collapsed, setCollapsed] = useState(() => readInitial(kind, id, defaultCollapsed));
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY(kind, id), next ? '1' : '0'); } catch {}
      return next;
    });
  }, [kind, id]);
  // forceOpen wins over user state without overwriting it — when search
  // clears, the previously persisted collapse returns.
  return { collapsed: forceOpen ? false : collapsed, toggle };
}
