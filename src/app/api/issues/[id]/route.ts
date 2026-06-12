import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
  if (error) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const patch = await req.json();
  const supabase = createServerSupabaseClient();
  const allowed = ['name', 'deadline', 'sort_mode', 'position', 'notion_issue_id'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }
  const { data, error } = await supabase
    .from('issues')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cascade = new URL(req.url).searchParams.get('cascade') ?? 'detach';
  const supabase = createServerSupabaseClient();
  if (cascade === 'delete') {
    const { data: direct, error: fetchErr } = await supabase
      .from('tasks')
      .select('id')
      .eq('issue_id', id)
      .eq('is_deleted', false);
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (direct && direct.length > 0) {
      const ids = direct.map((t: { id: string }) => t.id);
      const { error: subErr } = await supabase
        .from('tasks').update({ is_deleted: true }).in('parent_task_id', ids);
      if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
      const { error: taskErr } = await supabase
        .from('tasks').update({ is_deleted: true }).in('id', ids);
      if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });
    }
  } else {
    const { error: detachErr } = await supabase
      .from('tasks').update({ issue_id: null }).eq('issue_id', id);
    if (detachErr) return NextResponse.json({ error: detachErr.message }, { status: 500 });
  }
  const { error: issueErr } = await supabase
    .from('issues').update({ is_deleted: true }).eq('id', id);
  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, cascade });
}
