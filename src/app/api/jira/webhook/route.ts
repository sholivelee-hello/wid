import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { broadcastTasksChanged } from '@/lib/realtime-broadcast';

// JIRA 시스템 웹훅 수신 엔드포인트.
// 알림 4종만 TASK로 만든다 (docs/architecture/jira.md):
//   ① 나에게 새로 할당             (jira:issue_created / jira:issue_updated + changelog)
//   ② 댓글에서 나를 멘션           (comment_created, body에 내 accountId 멘션)
//   ③ 내가 담당자인 이슈에 새 댓글  (comment_created, assignee = 나)
//   ④ 내가 보고자인 이슈의 상태 변경 (jira:issue_updated + changelog status, reporter = 나)
// 내가 직접 한 행동(스스로 할당·내가 쓴 댓글·내가 바꾼 상태)은 알림이 아니므로 건너뛴다 —
// JIRA 자체 알림 정책과 동일.
//
// 인증: JIRA Cloud 시스템 웹훅은 서명을 지원하지 않으므로 URL 쿼리의
// token을 JIRA_WEBHOOK_SECRET과 비교한다 (Slack의 signing secret 대응물).

const JIRA_FALLBACK_SITE = 'https://mirapartners.atlassian.net';

// ADF(Atlassian Document Format) 댓글 본문에서 사람이 읽을 텍스트만 추출.
// JIRA Cloud 웹훅은 댓글 body를 wiki 문자열 또는 ADF 객체로 보낼 수 있어
// 둘 다 처리한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adfToText(node: any): string {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.text === 'string') return node.text;
  // mention 노드는 "@이름" 표기를 보존
  if (node.type === 'mention' && node.attrs?.text) return node.attrs.text;
  const children = Array.isArray(node.content) ? node.content : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children.map((c: any) => adfToText(c)).join(node.type === 'paragraph' ? '' : ' ');
}

// wiki 마크업 멘션([~accountid:xxx])을 사람이 읽을 수 있게 정리
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commentBodyToText(body: any): string {
  if (typeof body === 'string') {
    return body.replace(/\[~accountid:[^\]]+\]/g, '@멘션').trim();
  }
  return adfToText(body).trim();
}

export async function POST(request: NextRequest) {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  const me = process.env.JIRA_OWNER_ACCOUNT_ID;
  if (!secret || !me) {
    console.error('[jira/webhook] JIRA_WEBHOOK_SECRET / JIRA_OWNER_ACCOUNT_ID not set');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }
  if (request.nextUrl.searchParams.get('token') !== secret) {
    return NextResponse.json({ error: 'invalid token' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const webhookEvent: string = payload?.webhookEvent ?? '';
  const issue = payload?.issue;
  if (!issue?.key) return NextResponse.json({ ok: true });

  const issueKey: string = issue.key;
  const summary: string = issue.fields?.summary ?? '';
  const assigneeId: string | null = issue.fields?.assignee?.accountId ?? null;
  const reporterId: string | null = issue.fields?.reporter?.accountId ?? null;

  // 사이트 주소는 payload의 self URL에서 유도 (env 하드코딩 의존 최소화)
  let siteOrigin = JIRA_FALLBACK_SITE;
  try {
    if (issue.self) siteOrigin = new URL(issue.self).origin;
  } catch {
    // fallback 유지
  }
  const browseUrl = `${siteOrigin}/browse/${issueKey}`;

  const requestedAt = payload?.timestamp
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  const supabase = createServerSupabaseClient();

  // 분류: 어떤 알림인지 판정 → 없으면 무시
  let eventKey: string | null = null;
  let title: string | null = null;
  let requester: string | null = null;
  let jiraUrl = browseUrl;

  if (webhookEvent === 'comment_created') {
    const comment = payload?.comment;
    const authorId: string | null = comment?.author?.accountId ?? null;
    const authorName: string = comment?.author?.displayName ?? 'JIRA';
    if (!comment?.id || authorId === me) return NextResponse.json({ ok: true });

    const rawBody = comment.body;
    const bodyText = commentBodyToText(rawBody);
    // 멘션 감지: wiki([~accountid:me])든 ADF(mention 노드 id)든 직렬화에
    // accountId가 그대로 들어가므로 문자열 포함 검사로 둘 다 잡힌다.
    const serialized = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? '');
    const mentioned = serialized.includes(me);

    if (!mentioned && assigneeId !== me) return NextResponse.json({ ok: true });

    eventKey = `comment:${comment.id}`;
    const snippet = bodyText.slice(0, 140) || '(내용 없음)';
    title = mentioned
      ? `${issueKey} 멘션: ${snippet}`
      : `${issueKey} 댓글: ${snippet}`;
    requester = authorName;
    jiraUrl = `${browseUrl}?focusedCommentId=${comment.id}`;
  } else if (webhookEvent === 'jira:issue_created' || webhookEvent === 'jira:issue_updated') {
    const actorId: string | null = payload?.user?.accountId ?? null;
    const actorName: string = payload?.user?.displayName ?? 'JIRA';
    if (actorId === me) return NextResponse.json({ ok: true });

    let assignedToMe = false;
    let changeId: string = 'created';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let statusItem: any = null;
    if (webhookEvent === 'jira:issue_created') {
      assignedToMe = assigneeId === me;
    } else {
      const items: { field?: string; fieldId?: string; to?: string; fromString?: string; toString?: string }[] =
        payload?.changelog?.items ?? [];
      assignedToMe = items.some(
        (it) => (it.fieldId === 'assignee' || it.field === 'assignee') && it.to === me,
      );
      statusItem =
        items.find((it) => it.fieldId === 'status' || it.field === 'status') ?? null;
      changeId = String(payload?.changelog?.id ?? payload?.timestamp ?? '');
    }

    if (assignedToMe) {
      // ① 할당. 같은 changelog에 status 변경이 함께 있어도 할당 우선, task 1개만
      //   (②③ 멘션 우선 규칙과 같은 단순화).
      eventKey = `assign:${issue.id}:${changeId}`;
      title = `${issueKey} 할당: ${summary}`;
      requester = actorName;
    } else if (statusItem && reporterId === me) {
      // ④ 내가 보고자인 이슈의 상태가 타인에 의해 바뀜 (actorId === me 는 위에서 이미 제외).
      const from = statusItem.fromString ?? '?';
      const to = statusItem.toString ?? '?';
      eventKey = `status:${issue.id}:${changeId}`;
      title = `${issueKey} 상태: ${from} → ${to} — ${summary}`;
      requester = actorName;
    } else {
      return NextResponse.json({ ok: true });
    }
  }

  if (!eventKey || !title) return NextResponse.json({ ok: true });

  // 중복 방지 — JIRA가 같은 이벤트를 재전송해도 task가 두 번 생기지 않게
  const { data: dup } = await supabase
    .from('jira_events')
    .select('event_key')
    .eq('event_key', eventKey)
    .maybeSingle();
  if (dup) return NextResponse.json({ ok: true });

  const { error: dedupErr } = await supabase
    .from('jira_events')
    .insert({ event_key: eventKey });
  if (dedupErr) console.error('[jira/webhook] dedup insert failed', eventKey, dedupErr);

  const { error: insertErr } = await supabase.from('tasks').insert({
    title: title.slice(0, 200),
    source: 'jira',
    jira_url: jiraUrl,
    jira_issue_key: issueKey,
    requester,
    requested_at: requestedAt,
  });
  if (insertErr) {
    console.error('[jira/webhook] task insert failed', eventKey, insertErr);
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  await broadcastTasksChanged('jira');

  return NextResponse.json({ ok: true });
}
