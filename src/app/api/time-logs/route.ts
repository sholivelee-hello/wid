import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from'); // YYYY-MM-DD
  const to = sp.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  if (isMockMode()) {
    const filtered = MOCK_TIMELOGS.filter(log => {
      return log.started_at >= fromIso && log.started_at <= toIso;
    });
    return NextResponse.json(filtered);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .gte('started_at', fromIso)
    .lte('started_at', toIso);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
