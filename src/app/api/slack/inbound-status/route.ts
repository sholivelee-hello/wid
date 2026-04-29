import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Inbound webhook health: did Slack actually reach our server recently?
// auth.test (in /api/slack/test) only proves outbound — for local dev
// where cloudflared can be down, this endpoint surfaces the silent gap.
export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: latest, error } = await supabase
    .from('slack_events')
    .select('event_id, created_at')
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
    .from('slack_events')
    .select('event_id', { count: 'exact', head: true })
    .gte('created_at', since);

  return NextResponse.json({
    ok: true,
    lastEventAt: latest?.created_at ?? null,
    count24h: count ?? 0,
  });
}
