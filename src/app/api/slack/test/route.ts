import { NextResponse } from 'next/server';

// Slack 봇 토큰이 살아있는지 확인. webhook 역방향이 아니라 Slack의 auth.test
// API를 직접 호출해서 응답을 본다 — 이게 실제 "연결되어 있다"의 진짜 의미.
export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'SLACK_BOT_TOKEN 미설정' },
      { status: 200 },
    );
  }

  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      team?: string;
      user?: string;
      bot_id?: string;
    };
    if (!data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error ?? 'auth.test 실패' },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      team: data.team,
      bot: data.user,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'network error' },
      { status: 200 },
    );
  }
}
