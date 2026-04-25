/**
 * Google Calendar embed configuration. Stored in localStorage so the user can
 * paste calendar IDs / embed URLs without server round-trips.
 *
 * Each calendar entry can be either:
 *   1. A bare calendar id (`example@gmail.com` or `xyz@group.calendar.google.com`)
 *   2. A full embed URL (https://calendar.google.com/calendar/embed?src=…)
 *      In this case we extract every `src=` param so subscribed calendars
 *      pasted as a combined URL still work.
 */

const KEY = 'wid-gcal-config';
const LEGACY_KEY = 'wid-gcal-embed';
const EVENT = 'gcal-embed-changed';
export const GCAL_EMBED_EVENT = EVENT;

export type GCalDarkMode = 'auto' | 'light' | 'dark';

export interface GCalConfig {
  calendars: string[];
  startHour: number; // 0–23
  endHour: number;   // 1–24
  darkMode: GCalDarkMode;
}

export const DEFAULT_GCAL_CONFIG: GCalConfig = {
  calendars: [],
  startHour: 7,
  endHour: 21,
  darkMode: 'auto',
};

export function getGCalConfig(): GCalConfig {
  if (typeof window === 'undefined') return DEFAULT_GCAL_CONFIG;
  // New schema first
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GCalConfig>;
      return {
        calendars: Array.isArray(parsed.calendars) ? parsed.calendars.filter(Boolean) : [],
        startHour: clamp(Number(parsed.startHour ?? DEFAULT_GCAL_CONFIG.startHour), 0, 23),
        endHour: clamp(Number(parsed.endHour ?? DEFAULT_GCAL_CONFIG.endHour), 1, 24),
        darkMode: (parsed.darkMode === 'light' || parsed.darkMode === 'dark') ? parsed.darkMode : 'auto',
      };
    }
  } catch {/* fall through to legacy */}
  // Legacy single-string migration
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && legacy.trim()) {
    return { ...DEFAULT_GCAL_CONFIG, calendars: [legacy.trim()] };
  }
  return DEFAULT_GCAL_CONFIG;
}

export function setGCalConfig(next: GCalConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Pull every `src=` value out of a candidate string, falling back to the
 *  string itself if it looks like a bare calendar id. */
function extractCalendarIds(raw: string): string[] {
  const v = raw.trim();
  if (!v) return [];
  if (v.startsWith('https://calendar.google.com/calendar/embed')) {
    try {
      const u = new URL(v);
      const srcs = u.searchParams.getAll('src');
      return srcs.length > 0 ? srcs : [];
    } catch {
      return [];
    }
  }
  if (/^[^\s@]+@[^\s@]+$/.test(v) || /^[a-zA-Z0-9_.-]+$/.test(v)) {
    return [v];
  }
  return [];
}

export function expandCalendarIds(entries: string[]): string[] {
  const out: string[] = [];
  for (const entry of entries) {
    for (const id of extractCalendarIds(entry)) {
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export type CalendarMode = 'WEEK' | 'MONTH' | 'AGENDA';

interface BuildOptions {
  mode?: CalendarMode;
  bgColor?: string; // hex like "#1f2937"
}

export function buildEmbedUrl(config: GCalConfig, opts: BuildOptions = {}): string | null {
  const ids = expandCalendarIds(config.calendars);
  if (ids.length === 0) return null;
  const params = new URLSearchParams();
  for (const id of ids) params.append('src', id);
  params.set('mode', opts.mode ?? 'WEEK');
  params.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Hide chrome that fights with our wrapper
  params.set('showTitle', '0');
  params.set('showPrint', '0');
  params.set('showCalendars', '0');
  params.set('showTabs', '0');
  params.set('showTz', '0');
  if (opts.bgColor) params.set('bgcolor', opts.bgColor);
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}
