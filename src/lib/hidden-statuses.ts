'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wid-hidden-default-statuses';

/** Get the set of hidden default status names from localStorage. */
export function getHiddenDefaultStatuses(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

/** Hide a default status (add to the hidden set). */
export function hideDefaultStatus(name: string): void {
  if (typeof window === 'undefined') return;
  const set = getHiddenDefaultStatuses();
  set.add(name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  // Notify other components
  window.dispatchEvent(new CustomEvent('hidden-statuses-changed'));
}

/** Unhide a default status. */
export function unhideDefaultStatus(name: string): void {
  if (typeof window === 'undefined') return;
  const set = getHiddenDefaultStatuses();
  set.delete(name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent('hidden-statuses-changed'));
}

/** React hook to subscribe to hidden-status changes. */
export function useHiddenStatuses(): Set<string> {
  const [hidden, setHidden] = useState<Set<string>>(() => getHiddenDefaultStatuses());

  useEffect(() => {
    const update = () => setHidden(getHiddenDefaultStatuses());
    window.addEventListener('hidden-statuses-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('hidden-statuses-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return hidden;
}

/**
 * Filter out hidden default statuses from a list of status names.
 * This does NOT filter custom statuses (they have their own delete mechanism).
 */
export function filterVisibleStatuses(
  statuses: readonly string[],
  hidden: Set<string>
): string[] {
  return statuses.filter(s => !hidden.has(s));
}
