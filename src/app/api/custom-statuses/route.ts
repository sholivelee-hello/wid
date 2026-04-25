import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_CUSTOM_STATUSES } from '@/lib/mock-data';

export async function GET() {
  if (isMockMode()) {
    const sorted = [...MOCK_CUSTOM_STATUSES].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json(sorted);
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('custom_statuses')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (isMockMode()) {
    const body = await request.json();
    const newStatus = {
      id: `mock-cs-${Date.now()}`,
      name: body.name,
      color: body.color ?? '#6B7280',
      created_at: new Date().toISOString(),
    };
    return NextResponse.json(newStatus, { status: 201 });
  }

  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('custom_statuses')
    .insert({ name: body.name, color: body.color ?? '#6B7280' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
