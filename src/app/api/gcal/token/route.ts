import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 클라이언트가 Google Calendar API를 부를 때 쓸 access token을 내려준다.
// 서버가 보관한 refresh_token으로 자동 갱신하므로 사용자는 재로그인이
// 필요 없다. 모듈 레벨 캐시로 구글 토큰 엔드포인트 호출을 아낀다
// (Fluid Compute 인스턴스 재사용 시 유효 — 빗나가도 정확성엔 무해).

let cached: { accessToken: string; expiresAt: number; email: string | null } | null = null;

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ connected: false, reason: 'not_configured' });
  }

  // 60초 여유를 두고 캐시 재사용
  if (cached && Date.now() + 60_000 < cached.expiresAt) {
    return NextResponse.json({ connected: true, ...cached });
  }

  const supabase = createServerSupabaseClient();
  const { data: row } = await supabase
    .from('gcal_oauth')
    .select('refresh_token, email')
    .eq('id', 'default')
    .maybeSingle();

  if (!row?.refresh_token) {
    return NextResponse.json({ connected: false, reason: 'no_token' });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const token = await tokenRes.json();

  if (!tokenRes.ok || !token.access_token) {
    // invalid_grant = 사용자가 구글 보안 화면에서 권한을 회수한 경우.
    // 죽은 토큰을 남겨두면 영원히 실패하므로 지우고 재연동을 유도한다.
    if (token.error === 'invalid_grant') {
      await supabase.from('gcal_oauth').delete().eq('id', 'default');
      cached = null;
      return NextResponse.json({ connected: false, reason: 'revoked' });
    }
    console.error('[gcal/token] refresh failed', token);
    return NextResponse.json({ connected: false, reason: 'refresh_failed' });
  }

  cached = {
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    email: row.email ?? null,
  };
  return NextResponse.json({ connected: true, ...cached });
}
