/**
 * Google Calendar OAuth — server-managed Authorization Code flow.
 *
 * 2026-06-04 전환: 기존 GIS implicit flow(브라우저에서 1시간짜리 access token만
 * 발급, localStorage 보관)는 만료마다 사용자가 다시 로그인해야 했다. 이제
 * 서버가 refresh_token을 보관(`gcal_oauth` 테이블)하고 `/api/gcal/token`이
 * access token을 자동 갱신한다 — 한 번 연동하면 계속 이어진다.
 *
 * 클라이언트 계약:
 * - 연동 시작: `/api/gcal/oauth/start`로 이동 (full page redirect)
 * - API 호출 전: `ensureFreshOAuth()`로 유효한 토큰 확보 (만료 시 서버에서
 *   재발급받아 GCalConfig.oauth에 갱신 저장)
 * - 연동 해제: POST `/api/gcal/disconnect`
 */

import {
  getGCalConfig,
  setGCalConfig,
  type GCalOAuthState,
} from './gcal-embed';

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
// Token utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the token state is absent or will expire within `skewMs`
 * milliseconds (default: 60 s).
 */
export function isTokenExpired(state: GCalOAuthState | null, skewMs = 60_000): boolean {
  if (!state) return true;
  return Date.now() + skewMs >= state.expiresAt;
}

/** In-flight ensure promise — 동시 호출(오늘/히스토리 동시 마운트)이 토큰
 *  fetch를 공유하게 한다. */
let _ensurePromise: Promise<GCalOAuthState | null> | null = null;

/**
 * Returns a valid OAuth state, refreshing from the server when the local one
 * is missing/expired. Updates GCalConfig.oauth (and broadcasts
 * GCAL_EMBED_EVENT) when a new token is obtained. Returns null when the
 * server has no connection (사용자가 아직 연동 안 함 / 권한 회수).
 */
export async function ensureFreshOAuth(): Promise<GCalOAuthState | null> {
  const config = getGCalConfig();
  if (config.oauth && !isTokenExpired(config.oauth)) return config.oauth;

  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = (async () => {
    try {
      const res = await fetch('/api/gcal/token');
      const data = (await res.json()) as {
        connected: boolean;
        accessToken?: string;
        expiresAt?: number;
        email?: string | null;
      };

      const current = getGCalConfig();
      if (!data.connected || !data.accessToken || !data.expiresAt) {
        // 서버에 연동 없음 — 만료된 로컬 토큰이 남아있으면 정리해서
        // UI가 "연동됨"으로 거짓말하지 않게 한다.
        if (current.oauth) setGCalConfig({ ...current, oauth: null });
        return null;
      }

      const oauth: GCalOAuthState = {
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        email: data.email ?? current.oauth?.email,
      };
      setGCalConfig({ ...current, oauth });
      return oauth;
    } catch {
      return null;
    } finally {
      _ensurePromise = null;
    }
  })();

  return _ensurePromise;
}
