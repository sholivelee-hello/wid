import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Google OAuth Authorization Code flow — 2단계: code → 토큰 교환.
// refresh_token을 gcal_oauth 테이블(단일 행)에 저장하고 /settings로 복귀.

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings?gcal=error&reason=${reason}`, origin));

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('not_configured');

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail(params.get('error') ?? 'denied');

  const code = params.get('code');
  if (!code) return fail('no_code');

  // CSRF: start에서 심은 쿠키와 state가 일치해야 한다.
  const cookieState = request.cookies.get('gcal_oauth_state')?.value;
  if (!cookieState || cookieState !== params.get('state')) return fail('bad_state');

  // code → access_token + refresh_token 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/gcal/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.refresh_token) {
    console.error('[gcal/oauth] token exchange failed', token);
    return fail('exchange_failed');
  }

  // 연동 계정 표시용 이메일 (실패해도 연동 자체는 진행)
  let email: string | null = null;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (userRes.ok) email = (await userRes.json()).email ?? null;
  } catch {
    // best-effort
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('gcal_oauth').upsert({
    id: 'default',
    refresh_token: token.refresh_token,
    email,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[gcal/oauth] refresh token save failed', error);
    return fail('save_failed');
  }

  const res = NextResponse.redirect(new URL('/settings?gcal=connected', origin));
  res.cookies.delete('gcal_oauth_state');
  return res;
}
