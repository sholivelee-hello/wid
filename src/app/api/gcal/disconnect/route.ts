import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// 연결 해제: 구글 쪽 refresh_token revoke(베스트에포트) + DB 행 삭제.
export async function POST() {
  const supabase = createServerSupabaseClient();

  const { data: row } = await supabase
    .from('gcal_oauth')
    .select('refresh_token')
    .eq('id', 'default')
    .maybeSingle();

  if (row?.refresh_token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`,
        { method: 'POST' },
      );
    } catch {
      // revoke 실패해도 로컬 삭제는 진행 (best-effort)
    }
  }

  const { error } = await supabase.from('gcal_oauth').delete().eq('id', 'default');
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
