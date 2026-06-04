// 서버 전용 Realtime Broadcast 헬퍼.
// 웹훅/sync로 서버 DB에 task가 생기면, 열려 있는 브라우저가 목록을 다시
// 불러오도록 공개 broadcast 채널(wid-tasks)에 "변경 있음" 신호만 쏜다.
// 데이터는 싣지 않는다 — 목록 재조회는 기존 /api/tasks가 담당.
//
// RLS가 켜져 있어(003 마이그레이션) anon은 테이블에 접근할 수 없으므로,
// 브라우저는 이 broadcast 채널만 구독한다 — docs/architecture/realtime.md.
//
// fire-and-forget: 실패해도 throw하지 않는다 (웹훅 흐름을 깨지 않기 위해).
// 키/URL이 없으면 조용히 no-op. Vercel 함수는 응답 반환 후 백그라운드 실행이
// 죽을 수 있으므로 await + 3초 timeout으로 응답 전에 끝낸다.

export async function broadcastTasksChanged(source: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ topic: 'wid-tasks', event: 'changed', payload: { source } }],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.warn('[realtime-broadcast] failed', source, e);
  }
}
