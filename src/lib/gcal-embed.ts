/**
 * Google Calendar configuration. Stored in localStorage so OAuth tokens and
 * the fetched subscribed-calendar list survive reloads for a single-user
 * personal app.
 *
 * `subscribedCalendars` is the list returned by the Google Calendar
 * `calendarList.list` endpoint after OAuth — populated by `gcal-api.ts`.
 */

const KEY = 'wid-gcal-config';
const EVENT = 'gcal-embed-changed';
export const GCAL_EMBED_EVENT = EVENT;

export interface SubscribedCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

export interface GCalOAuthState {
  accessToken: string;
  expiresAt: number; // ms epoch
  email?: string;
  scope?: string;
}

export interface GCalConfig {
  oauth: GCalOAuthState | null;
  subscribedCalendars: SubscribedCalendar[];
  /** Calendar IDs the user has toggled off; events from these are hidden. */
  disabled: string[];
}

export const DEFAULT_GCAL_CONFIG: GCalConfig = {
  oauth: null,
  subscribedCalendars: [],
  disabled: [],
};

export function getGCalConfig(): GCalConfig {
  if (typeof window === 'undefined') return DEFAULT_GCAL_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        oauth: isOAuthState(parsed.oauth) ? parsed.oauth : null,
        subscribedCalendars: Array.isArray(parsed.subscribedCalendars)
          ? parsed.subscribedCalendars.filter((c): c is SubscribedCalendar => !!c && typeof c.id === 'string')
          : [],
        disabled: Array.isArray(parsed.disabled)
          ? parsed.disabled.filter((s): s is string => typeof s === 'string')
          : [],
      };
    }
  } catch {/* fall through */}
  return DEFAULT_GCAL_CONFIG;
}

export function setGCalConfig(next: GCalConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function isOAuthState(v: unknown): v is GCalOAuthState {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.accessToken === 'string' && typeof o.expiresAt === 'number';
}

/** Subscribed calendar IDs minus the ones the user toggled off.
 *  Order preserved from calendarList.list. */
export function getActiveCalendarIds(config: GCalConfig): string[] {
  const off = new Set(config.disabled);
  return config.subscribedCalendars.map(c => c.id).filter(id => !off.has(id));
}

/** Stable Google Calendar palette used for color fallback. */
const CAL_COLOR_PALETTE = [
  '#7986CB', '#33B679', '#8E24AA', '#E67C73', '#F6BF26',
  '#F4511E', '#039BE5', '#616161', '#3F51B5', '#0B8043',
  '#D50000', '#3CB371', '#A0522D', '#1B887A', '#B1365F',
];

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Color for a calendar — prefers OAuth-discovered backgroundColor, falls back
 *  to a stable palette pick by id hash so the same calendar always renders
 *  the same color. */
export function getCalendarColor(id: string, config: GCalConfig): string {
  const sub = config.subscribedCalendars.find(c => c.id === id);
  if (sub?.backgroundColor) return sub.backgroundColor;
  return CAL_COLOR_PALETTE[hashStr(id) % CAL_COLOR_PALETTE.length];
}

/** Best-effort display label — OAuth summary if available, otherwise the raw id. */
export function getCalendarLabel(id: string, config: GCalConfig): string {
  const sub = config.subscribedCalendars.find(c => c.id === id);
  return sub?.summary || id;
}
