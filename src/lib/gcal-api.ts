/**
 * Google Calendar REST API calls — client-side, no backend proxy.
 *
 * All functions accept a raw OAuth access token obtained via `gcal-oauth.ts`
 * and stored in localStorage through `GCalConfig.oauth`. Tokens are short-lived
 * (~1 h); callers should check `isTokenExpired` before calling these functions
 * and refresh as needed.
 *
 * No googleapis SDK is used — requests are plain `fetch` calls against the
 * Google Calendar v3 REST API and the OAuth2 userinfo endpoint.
 */

import type { SubscribedCalendar } from './gcal-embed';

// ---------------------------------------------------------------------------
// Internal types for API response shapes
// ---------------------------------------------------------------------------

interface CalendarListItem {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
  selected?: boolean;
}

interface CalendarListResponse {
  items?: CalendarListItem[];
}

interface UserInfoResponse {
  email?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated user's subscribed calendars from the Google
 * Calendar calendarList endpoint.
 *
 * Maps raw API items to `SubscribedCalendar`, preferring `summaryOverride`
 * over `summary` for the display name (Google sets summaryOverride when the
 * user has renamed a calendar locally).
 *
 * Throws `new Error('unauthorized')` on HTTP 401, or an error with the HTTP
 * status text for other non-OK responses. Returns `[]` on an empty or missing
 * items array.
 */
export async function fetchSubscribedCalendars(
  accessToken: string,
): Promise<SubscribedCalendar[]> {
  const url =
    'https://www.googleapis.com/calendar/v3/users/me/calendarList' +
    '?minAccessRole=reader&maxResults=250';

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error('unauthorized');
  }

  if (!response.ok) {
    throw new Error(response.statusText || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as CalendarListResponse;
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map(
    (item): SubscribedCalendar => ({
      id: item.id,
      summary: item.summaryOverride ?? item.summary,
      backgroundColor: item.backgroundColor,
      primary: item.primary,
      accessRole: item.accessRole,
    }),
  );
}

/**
 * Returns the email address of the authenticated Google account, or `null` on
 * any error (network failure, invalid token, missing field). Used to display
 * "signed in as X" in the settings UI.
 */
export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as UserInfoResponse;
    return typeof data.email === 'string' && data.email.length > 0 ? data.email : null;
  } catch {
    return null;
  }
}
