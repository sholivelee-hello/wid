import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_TIMELOGS } from '@/lib/mock-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    const logs = MOCK_TIMELOGS
      .filter((l) => l.task_id === id)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return NextResponse.json(logs);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('task_id', id)
    .order('started_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
