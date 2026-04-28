import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('notion_status_mappings').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  await supabase.from('notion_status_mappings').delete().gte('created_at', '1970-01-01');

  if (body.mappings?.length > 0) {
    const { error } = await supabase.from('notion_status_mappings').insert(body.mappings);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
