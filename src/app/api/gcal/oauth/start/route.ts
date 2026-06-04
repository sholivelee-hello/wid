import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Google OAuth Authorization Code flow — 1단계: 구글 동의 화면으로 리다이렉트.
// access_type=offline + prompt=consent 조합이어야 refresh_token이 발급된다.
// (refresh_token은 서버가 보관하고 /api/gcal/token이 자동 갱신 — 한 번
// 연동하면 다시 로그인할 필요가 없다. docs/architecture/calendar-embed.md)

// route 파일은 GET/POST 외 export가 금지라 모듈 로컬 const로 둔다.
const GCAL_SERVER_SCOPE =
  'openid email https://www.googleapis.com/auth/calendar.readonly';

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/settings?gcal=error&reason=not_configured', request.nextUrl.origin),
    );
  }

  // CSRF 방지용 state — 콜백에서 쿠키와 대조한다.
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set(
    'redirect_uri',
    `${request.nextUrl.origin}/api/gcal/oauth/callback`,
  );
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GCAL_SERVER_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('gcal_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 600,
    path: '/',
  });
  return res;
}
