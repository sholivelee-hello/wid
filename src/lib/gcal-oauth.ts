/**
 * Google Calendar OAuth — client-side implicit flow via Google Identity Services (GIS).
 *
 * Model: single-user personal app. No backend. The access token is obtained
 * entirely in the browser using `google.accounts.oauth2.initTokenClient` and
 * stored in localStorage via `GCalConfig.oauth` (see `gcal-embed.ts`).
 *
 * Security trade-off: implicit / token flow exposes the access token to
 * JavaScript running in the page. This is acceptable for a personal,
 * single-user app with no multi-tenant data, but would be inappropriate for a
 * production multi-user service (which should use an Authorization Code + PKCE
 * flow with a backend token store instead).
 */

import type { GCalOAuthState } from './gcal-embed';

export const GCAL_OAUTH_SCOPE =
  'openid email profile https://www.googleapis.com/auth/calendar.readonly';

/** Cached promise for the GSI script load so concurrent callers share it. */
let _gsiLoadPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/** Returns the NEXT_PUBLIC_GOOGLE_CLIENT_ID env value, or null if absent. */
export function getGoogleClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return id && id.length > 0 ? id : null;
}

/** True iff a non-empty client ID is configured. */
export function isGoogleOAuthConfigured(): boolean {
  return getGoogleClientId() !== null;
}

// ---------------------------------------------------------------------------
// GSI script loader
// ---------------------------------------------------------------------------

/**
 * Idempotently injects the GIS script into `document.head` and resolves once
 * `window.google.accounts.oauth2` is available. Rejects after 10 s.
 *
 * SSR-safe: rejects immediately if called outside a browser context.
 */
export async function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('loadGsiScript must be called in a browser context'));
  }

  // Already loaded — fast path.
  if (window.google?.accounts?.oauth2) return;

  // Return the in-flight promise if one exists.
  if (_gsiLoadPromise) return _gsiLoadPromise;

  _gsiLoadPromise = new Promise<void>((resolve, reject) => {
    const GSI_SRC = 'https://accounts.google.com/gsi/client';

    // Inject script only once.
    if (!document.querySelector(`script[src="${GSI_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const TIMEOUT_MS = 10_000;
    const deadline = Date.now() + TIMEOUT_MS;

    const poll = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Timed out waiting for Google Identity Services script'));
        return;
      }
      setTimeout(poll, 100);
    };

    poll();
  });

  return _gsiLoadPromise;
}

// ---------------------------------------------------------------------------
// Token request
// ---------------------------------------------------------------------------

/**
 * Requests a new Google OAuth access token using the GIS implicit flow.
 *
 * Ensures the GIS script is loaded, then wraps `initTokenClient` +
 * `requestAccessToken` in a Promise. The returned `GCalOAuthState` includes
 * the raw token, its expiry epoch (ms), and the granted scope.
 */
export async function requestAccessToken(
  opts?: { prompt?: 'none' | 'consent' | '' },
): Promise<GCalOAuthState> {
  await loadGsiScript();

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Cannot request a Google OAuth token.',
    );
  }

  return new Promise<GCalOAuthState>((resolve, reject) => {
    const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: GCAL_OAUTH_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        const state: GCalOAuthState = {
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
          scope: response.scope,
        };
        resolve(state);
      },
      error_callback: (detail) => {
        reject(new Error(detail.message ?? 'oauth_error'));
      },
    });

    tokenClient.requestAccessToken({ prompt: opts?.prompt ?? 'consent' });
  });
}

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the token state is absent or will expire within `skewMs`
 * milliseconds (default: 60 s). Use before every API call to decide whether
 * to refresh.
 */
export function isTokenExpired(state: GCalOAuthState | null, skewMs = 60_000): boolean {
  if (!state) return true;
  return Date.now() + skewMs >= state.expiresAt;
}

/**
 * Revokes the given access token via Google's revocation endpoint.
 * Errors are swallowed — this is best-effort cleanup (e.g. on sign-out).
 */
export async function revokeAccessToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });
  } catch {
    // Best-effort: ignore network or CORS errors on revocation.
  }
}

// ---------------------------------------------------------------------------
// Window type augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token: string;
              expires_in: number;
              scope: string;
              error?: string;
            }) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }): { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}
