import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode, MOCK_CUSTOM_STATUSES } from '@/lib/mock-data';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (isMockMode()) {
    const status = MOCK_CUSTOM_STATUSES.find((s) => s.id === id);
    if (!status) return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    return NextResponse.json({ ...status, ...body });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('custom_statuses')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isMockMode()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('custom_statuses')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
