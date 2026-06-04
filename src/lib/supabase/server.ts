import { createClient } from '@supabase/supabase-js';

export function createServerSupabaseClient() {
  // 서버는 service role 키 사용 (RLS 우회). anon 키는 브라우저(Realtime)용으로
  // 노출되므로, RLS를 켜서 anon의 직접 테이블 접근을 차단한다 — 003 마이그레이션.
  // fallback: 키가 없는 환경(과거 배포 등)에서는 anon으로 동작 (RLS 켜기 전까지만 유효).
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
