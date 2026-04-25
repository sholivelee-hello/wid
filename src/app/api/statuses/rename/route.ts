import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from, to } = body as { from?: string; to?: string };

  if (!from || !to || from === to) {
    return NextResponse.json({ updated: 0 });
  }

  if (isMockMode()) {
    return NextResponse.json({ updated: 0 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('tasks')
    .update({ status: to })
    .eq('status', from);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: 1 });
}
