'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wid-default-status-renames';

export function getDefaultStatusRenames(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setDefaultStatusRename(originalName: string, newName: string): void {
  if (typeof window === 'undefined') return;
  const renames = getDefaultStatusRenames();
  if (newName === originalName) {
    delete renames[originalName];
  } else {
    renames[originalName] = newName;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(renames));
  window.dispatchEvent(new CustomEvent('status-renames-changed'));
}

export function useDefaultStatusRenames(): Record<string, string> {
  const [renames, setRenames] = useState<Record<string, string>>(() => getDefaultStatusRenames());

  useEffect(() => {
    const update = () => setRenames(getDefaultStatusRenames());
    window.addEventListener('status-renames-changed', update);
    return () => window.removeEventListener('status-renames-changed', update);
  }, []);

  return renames;
}
