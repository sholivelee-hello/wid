'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = (kind: 'issue' | 'task', id: string) => `wid:collapsed:${kind}:${id}`;

export const TREE_SET_ALL_EVENT = 'wid:tree-set-all';

export interface TreeSetAllDetail {
  collapsed: boolean;
}

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

  // Global "expand all / collapse all" — every node listens and snaps to
  // the broadcast state, persisting it so the choice sticks across reloads.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TreeSetAllDetail>).detail;
      if (!detail || typeof detail.collapsed !== 'boolean') return;
      setCollapsed(detail.collapsed);
      try { localStorage.setItem(KEY(kind, id), detail.collapsed ? '1' : '0'); } catch {}
    };
    window.addEventListener(TREE_SET_ALL_EVENT, handler);
    return () => window.removeEventListener(TREE_SET_ALL_EVENT, handler);
  }, [kind, id]);

  // forceOpen wins over user state without overwriting it — when search
  // clears, the previously persisted collapse returns.
  return { collapsed: forceOpen ? false : collapsed, toggle };
}

export function broadcastTreeSetAll(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  // Wipe persisted per-id state so newly mounted nodes also pick up the
  // new default. Otherwise, opening a previously-collapsed issue would
  // re-read its old localStorage value.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('wid:collapsed:')) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {}
  window.dispatchEvent(
    new CustomEvent<TreeSetAllDetail>(TREE_SET_ALL_EVENT, {
      detail: { collapsed },
    }),
  );
}
