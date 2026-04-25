import { STATUS_COLORS } from './constants';

const STORAGE_KEY = 'wid-status-color-overrides';

export function getStatusColorOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

export function setStatusColorOverride(name: string, color: string): void {
  if (typeof window === 'undefined') return;
  const o = getStatusColorOverrides();
  o[name] = color;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  window.dispatchEvent(new CustomEvent('status-colors-changed'));
}

export function removeStatusColorOverride(name: string): void {
  if (typeof window === 'undefined') return;
  const o = getStatusColorOverrides();
  delete o[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  window.dispatchEvent(new CustomEvent('status-colors-changed'));
}

/** Returns the effective color for a status, checking localStorage overrides first. */
export function getStatusColor(name: string): string {
  const overrides = getStatusColorOverrides();
  return overrides[name] ?? STATUS_COLORS[name] ?? '#6B7280';
}
