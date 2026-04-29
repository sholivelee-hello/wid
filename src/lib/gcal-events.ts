/**
 * Client-side helper to fetch real Google Calendar events for a date range
 * across multiple calendars via the Google Calendar v3 REST API.
 *
 * Designed for the personal single-user app model: tokens come from
 * localStorage via `gcal-embed.ts`; no backend proxy is involved.
 */

import type { GCalEvent } from './types';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RawGoogleEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri?: string; entryPointType?: string }>;
  };
  status?: string;
}

interface EventListResponse {
  items?: RawGoogleEvent[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------------
// Single-calendar fetcher (handles pagination)
// ---------------------------------------------------------------------------

async function listEventsForCalendar(
  token: string,
  calendarId: string,
  fromIso: string,
  toIso: string,
): Promise<RawGoogleEvent[]> {
  const results: RawGoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: fromIso,
      timeMax: toIso,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 401) {
      throw new Error('unauthorized');
    }

    if (!resp.ok) {
      // Non-auth error for this calendar — surface as empty list (caller catches)
      throw new Error(`calendar_fetch_error:${resp.status}`);
    }

    const data = (await resp.json()) as EventListResponse;
    if (Array.isArray(data.items)) {
      results.push(...data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD → Date (interpreted as local midnight) */
function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → YYYY-MM-DD in local timezone */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** dateTime string (ISO-8601) → "HH:MM" in local timezone */
function toLocalHHMM(dateTimeStr: string): string {
  const d = new Date(dateTimeStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Subtract one day from a YYYY-MM-DD string (end.date is exclusive for all-day events). */
function dayBefore(ymd: string): string {
  const d = localDate(ymd);
  d.setDate(d.getDate() - 1);
  return toYMD(d);
}

/** Add one day to a YYYY-MM-DD string. */
function dayAfter(ymd: string): string {
  const d = localDate(ymd);
  d.setDate(d.getDate() + 1);
  return toYMD(d);
}

// ---------------------------------------------------------------------------
// Normalize one raw event → zero or more GCalEvents
// ---------------------------------------------------------------------------

function normalizeEvent(
  raw: RawGoogleEvent,
  calendarId: string,
  rangeFrom: string,
  rangeTo: string,
): GCalEvent[] {
  // Skip cancelled events
  if (raw.status === 'cancelled') return [];

  const title = raw.summary?.trim() || '(제목 없음)';
  const location = raw.location;
  const attendees = raw.attendees?.map(a => a.displayName || a.email);
  const meetLink =
    raw.hangoutLink ??
    raw.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;

  const startDate = raw.start?.date;
  const startDT = raw.start?.dateTime;
  const endDate = raw.end?.date;

  // --- All-day event ---
  if (startDate && endDate) {
    // end.date is exclusive; last day = dayBefore(endDate)
    const inclusiveEnd = dayBefore(endDate);

    // Multi-day: emit one GCalEvent per day within rangeFrom..rangeTo
    const out: GCalEvent[] = [];
    let cursor = startDate;
    while (cursor <= inclusiveEnd) {
      if (cursor >= rangeFrom && cursor <= rangeTo) {
        out.push({
          id: `${raw.id}_${cursor}`,
          calendarId,
          title,
          date: cursor,
          location,
          attendees,
          meetLink,
        });
      }
      cursor = dayAfter(cursor);
      // Safety: stop if we overshoot range by a lot (shouldn't happen)
      if (cursor > rangeTo) break;
    }
    return out;
  }

  // --- Timed event ---
  if (startDT) {
    const date = toYMD(new Date(startDT));
    const time = toLocalHHMM(startDT);
    const endTime = raw.end?.dateTime ? toLocalHHMM(raw.end.dateTime) : undefined;

    // Only include if the start date falls within the requested range
    if (date < rangeFrom || date > rangeTo) return [];

    return [
      {
        id: raw.id,
        calendarId,
        title,
        date,
        time,
        endTime,
        location,
        attendees,
        meetLink,
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch events for many calendars in parallel, normalized to `GCalEvent[]`.
 *
 * - `from` / `to` are YYYY-MM-DD (inclusive).
 * - All-day multi-day events are expanded to one entry per day.
 * - Throws `new Error('unauthorized')` on any 401 so the caller can prompt re-login.
 * - Per-calendar non-auth errors are swallowed (returns [] for that calendar)
 *   so a single inaccessible shared calendar doesn't break the whole view.
 */
export async function fetchEventsForRange(
  token: string,
  calendarIds: string[],
  from: string,
  to: string,
): Promise<GCalEvent[]> {
  if (calendarIds.length === 0) return [];

  // Build RFC 3339 timestamps for the Calendar API.
  // `from` / `to` are YYYY-MM-DD interpreted as the user's local timezone;
  // we convert to UTC ISO so Google sees an unambiguous instant.
  // `timeMin` is the start of the `from` day; `timeMax` is the start of
  // the day after `to` (exclusive upper bound).
  const fromIso = localDate(from).toISOString();
  const toIso = localDate(dayAfter(to)).toISOString();

  const results = await Promise.allSettled(
    calendarIds.map(id => listEventsForCalendar(token, id, fromIso, toIso)),
  );

  const events: GCalEvent[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const err = result.reason;
      // Propagate auth errors immediately — caller must re-login
      if (err instanceof Error && err.message === 'unauthorized') {
        throw err;
      }
      // All other errors per-calendar: skip silently
      continue;
    }
    for (const raw of result.value) {
      events.push(...normalizeEvent(raw, calendarIds[i], from, to));
    }
  }

  // The same event id can arrive from multiple subscribed calendars when a
  // user is invited and also subscribes to the host's calendar. React keys
  // assume id uniqueness, so dedupe here at the source — first occurrence
  // wins.
  const seen = new Set<string>();
  return events.filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });
}
