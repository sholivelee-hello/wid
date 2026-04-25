/**
 * Google Calendar embed configuration. Stored in localStorage so the user can
 * paste their own embed URL or calendar ID without server round-trips.
 *
 * The user pastes either:
 *   1. A full embed URL (https://calendar.google.com/calendar/embed?src=...)
 *   2. A bare calendar ID (e.g. abc@gmail.com or abc@group.calendar.google.com)
 *
 * For (2) we synthesize the embed URL with sensible defaults.
 */

const KEY = 'wid-gcal-embed';
const EVENT = 'gcal-embed-changed';

export function getGCalEmbedRaw(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEY) ?? '';
}

export function setGCalEmbedRaw(value: string) {
  if (typeof window === 'undefined') return;
  if (value.trim()) localStorage.setItem(KEY, value.trim());
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const GCAL_EMBED_EVENT = EVENT;

/**
 * Returns a renderable embed URL given the stored raw value.
 * - If value already starts with `https://calendar.google.com/calendar/embed`, return as-is.
 * - If it looks like a bare calendar id, build a default embed URL.
 * - Otherwise return null.
 */
export function buildEmbedUrl(raw: string, mode: 'WEEK' | 'MONTH' | 'AGENDA' | 'DAY' = 'WEEK'): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith('https://calendar.google.com/calendar/embed')) {
    // Override the mode if specified, leave the rest of the URL alone.
    try {
      const u = new URL(v);
      u.searchParams.set('mode', mode);
      return u.toString();
    } catch {
      return v;
    }
  }
  // Treat as a bare calendar id (email-shaped).
  if (/^[^\s@]+@[^\s@]+$/.test(v) || /^[a-zA-Z0-9_.-]+$/.test(v)) {
    const params = new URLSearchParams({
      src: v,
      mode,
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return `https://calendar.google.com/calendar/embed?${params.toString()}`;
  }
  return null;
}
