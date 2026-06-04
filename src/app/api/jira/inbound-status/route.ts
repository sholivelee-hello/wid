import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Inbound webhook health: did JIRA actually reach our server recently?
// JIRA 연동은 인바운드 전용(웹훅 수신만)이라 outbound ping이 없다 —
// jira_events dedup 테이블이 곧 "도달했다"의 증거다 (slack inbound-status와
// 동일 패턴).
export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: latest, error } = await supabase
    .from('jira_events')
    .select('event_key, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 200 },
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('jira_events')
    .select('event_key', { count: 'exact', head: true })
    .gte('created_at', since);

  return NextResponse.json({
    ok: true,
    lastEventAt: latest?.created_at ?? null,
    count24h: count ?? 0,
  });
}
