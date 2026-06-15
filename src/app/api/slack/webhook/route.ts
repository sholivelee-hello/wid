import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { broadcastTasksChanged } from '@/lib/realtime-broadcast';
import crypto from 'crypto';

async function verifySlackSignature(request: NextRequest, body: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const slackSignature = request.headers.get('x-slack-signature') ?? '';

  const ts = parseInt(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  // timingSafeEqual은 길이가 다르면 throw — 길이 불일치는 명백한 불일치이므로 false.
  const a = Buffer.from(mySignature);
  const b = Buffer.from(slackSignature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Module-level cache: 같은 유저를 반복 조회하지 않도록 ID→이름 매핑을 보관.
// 성공적으로 해석된 이름만 캐시한다 (실패 시 ID를 반환하지만 캐시하지 않아,
// users:read scope이 나중에 부여되면 다음 호출에서 다시 시도된다).
const userNameCache = new Map<string, string>();

// Slack user.info → 한국어 display name 우선. real_name(영문) → username → ID 순.
// users.info 실패 시 (예: missing_scope) Vercel 로그에 원인을 남겨야 진단 가능.
async function fetchSlackUserName(userId: string, botToken: string): Promise<string> {
  const cached = userNameCache.get(userId);
  if (cached) return cached;
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[slack/webhook] users.info failed', { userId, error: data.error, needed: data.needed });
      return userId;
    }
    const profile = data.user?.profile;
    const name =
      profile?.display_name?.trim() ||
      profile?.real_name?.trim() ||
      data.user?.real_name ||
      data.user?.name ||
      '';
    if (!name) {
      console.error('[slack/webhook] users.info empty name', { userId, user: data.user });
      return userId;
    }
    userNameCache.set(userId, name);
    return name;
  } catch (e) {
    console.error('[slack/webhook] users.info threw', userId, e);
    return userId;
  }
}

// 메시지 객체에 이미 박혀있을 수 있는 user_profile fallback. conversations.history 응답에
// 가끔 message.user_profile이 동봉돼 오므로 users.info 실패해도 여기서 건질 수 있다.
function nameFromMessageProfile(message: {
  user?: string;
  user_profile?: { display_name?: string; real_name?: string; name?: string };
}): string | null {
  const p = message.user_profile;
  if (!p) return null;
  const name = p.display_name?.trim() || p.real_name?.trim() || p.name?.trim() || '';
  return name || null;
}

// Slack 메시지 텍스트의 markup을 사람이 읽을 수 있는 형태로 변환.
// - <@U_ID> / <@U_ID|name> → 한국어 display name (users.info 조회)
// - <#C_ID|channel> → #channel
// - <!here> / <!channel> / <!everyone> → @here 등
// - <!subteam^S_ID|@group> → @group
// - <URL|text> → text, <URL> → URL
async function resolveSlackText(text: string, botToken: string): Promise<string> {
  if (!text) return text;
  let result = text;

  const userIds = new Set<string>();
  for (const m of text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)) {
    userIds.add(m[1]);
  }
  const nameById = new Map<string, string>();
  await Promise.all(
    [...userIds].map(async id => {
      nameById.set(id, await fetchSlackUserName(id, botToken));
    }),
  );
  result = result.replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id) => `@${nameById.get(id) ?? id}`);

  result = result.replace(/<#[CG][A-Z0-9]+\|([^>]+)>/g, '#$1');
  result = result.replace(/<!subteam\^[A-Z0-9]+\|@?([^>]+)>/g, '@$1');
  result = result.replace(/<!(here|channel|everyone)>/g, '@$1');
  result = result.replace(/<((?:https?:)?\/\/[^|>]+)\|([^>]+)>/g, '$2');
  result = result.replace(/<((?:https?:)?\/\/[^>]+)>/g, '$1');
  result = result.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  return result;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  // 공개 엔드포인트 — 비 JSON body로 500이 나지 않게 방어.
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // url_verification은 서명 검증 전에 먼저 처리 — Slack이 URL 등록 시
  // 서명 없이 challenge를 보내는 경우에도 응답할 수 있어야 한다.
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const isValid = await verifySlackSignature(request, body);
  if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });

  if (payload.type !== 'event_callback') {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  const eventId = payload.event_id;

  const supabase = createServerSupabaseClient();

  // Jira relay channel: bot messages forwarded via Workflow Builder
  if (event.type === 'message' && event.bot_id) {
    const relayChannel = process.env.SLACK_JIRA_RELAY_CHANNEL;
    if (!relayChannel || event.channel !== relayChannel) return NextResponse.json({ ok: true });

    const { data: existing } = await supabase
      .from('slack_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true });
    const { error: relayDedupErr } = await supabase
      .from('slack_events')
      .insert({ event_id: eventId });
    if (relayDedupErr) {
      console.error('[slack/webhook] relay dedup insert failed', eventId, relayDedupErr);
      return NextResponse.json({ ok: true });
    }

    const rawText: string = event.text || event.attachments?.[0]?.text || event.attachments?.[0]?.fallback || '(Jira 알림)';
    const botToken = process.env.SLACK_BOT_TOKEN;
    const resolvedText = botToken ? await resolveSlackText(rawText, botToken) : rawText;
    const slackUrl = `https://slack.com/archives/${event.channel}/p${(event.ts as string).replace('.', '')}`;

    const { error: insertErr } = await supabase.from('tasks').insert({
      title: resolvedText.slice(0, 200),
      source: 'slack',
      slack_url: slackUrl,
      slack_channel: 'jira-relay',
      slack_sender: 'Jira',
      requester: 'Jira',
      requested_at: new Date(parseFloat(event.ts as string) * 1000).toISOString(),
    });
    if (insertErr) console.error('[slack/webhook] jira relay insert failed', slackUrl, insertErr);
    else await broadcastTasksChanged('slack');

    return NextResponse.json({ ok: true });
  }

  if (event.type !== 'reaction_added') return NextResponse.json({ ok: true });

  // Personal app: only the owner's own reactions should create/complete tasks.
  // The bot sits in shared team channels, so without this guard ANY teammate's
  // :send-away:/:완료: reaction would inject (or complete) a task in the
  // owner's inbox. event.user is the person who ADDED the reaction.
  // fail-closed: env 미설정이면 아무 반응도 처리하지 않는다 — 미설정 배포에서
  // 팀원 전원의 이모지가 내 인박스로 흘러드는 사고 방지.
  const ownerUserId = process.env.SLACK_OWNER_USER_ID;
  if (!ownerUserId) {
    console.error('[slack/webhook] SLACK_OWNER_USER_ID not set — ignoring reaction');
    return NextResponse.json({ ok: true });
  }
  if (event.user && event.user !== ownerUserId) {
    return NextResponse.json({ ok: true });
  }

  const triggerEmoji = process.env.SLACK_TRIGGER_EMOJI ?? 'send-away';
  const completeEmoji = process.env.SLACK_COMPLETE_EMOJI ?? '완료';

  // Only events we will actually act on (trigger or complete) reach the
  // dedup table — keeps slack_events meaningful as a "did inbound deliver"
  // signal in settings.
  if (event.reaction !== triggerEmoji && event.reaction !== completeEmoji) {
    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await supabase
    .from('slack_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true });

  const { error: dedupErr } = await supabase
    .from('slack_events')
    .insert({ event_id: eventId });
  if (dedupErr) {
    // unique 위반 = 동시 재전송이 이미 처리 중 — task 중복 생성 방지를 위해 중단.
    // 그 외 오류도 row가 없으니 Slack 재시도에서 다시 처리된다.
    console.error('[slack/webhook] dedup insert failed', eventId, dedupErr);
    return NextResponse.json({ ok: true });
  }

  // Handle completion emoji
  if (event.reaction === completeEmoji) {
    const slackUrl = `https://slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;

    // Find existing task by slack_url
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('slack_url', slackUrl)
      .maybeSingle();

    if (existingTask && existingTask.status !== '완료') {
      const { error: completeErr } = await supabase
        .from('tasks')
        .update({ status: '완료', completed_at: new Date().toISOString() })
        .eq('id', existingTask.id);
      if (completeErr) {
        console.error('[slack/webhook] complete update failed', existingTask.id, completeErr);
      }
    }

    return NextResponse.json({ ok: true });
  }

  const botToken = process.env.SLACK_BOT_TOKEN!;

  // 반응을 단 그 메시지를 정확히 가져온다. conversations.history는 채널 최상위
  // 타임라인만 반환해서, 스레드 답글에 반응하면 그 답글이 안 잡히고 직전 최상위
  // 메시지(= 스레드 부모/메인)가 잡혀 버린다. conversations.replies는 ts로 스레드
  // 부모·답글 어느 쪽이든 식별할 수 있고, oldest=latest=item.ts + inclusive로 핀하면
  // 부모·답글·일반 메시지 세 경우 모두 그 한 건만 반환된다 (추가 스코프 불필요).
  const msgRes = await fetch(
    `https://slack.com/api/conversations.replies?channel=${event.item.channel}&ts=${event.item.ts}&oldest=${event.item.ts}&latest=${event.item.ts}&inclusive=true&limit=1`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const msgData = await msgRes.json();
  // 안전장치: 응답에 여러 건이 와도 ts가 정확히 일치하는 메시지를 우선 채택.
  const message =
    msgData.messages?.find((m: { ts?: string }) => m.ts === event.item.ts) ?? msgData.messages?.[0];

  if (!message) return NextResponse.json({ ok: true });

  const channelRes = await fetch(
    `https://slack.com/api/conversations.info?channel=${event.item.channel}`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const channelData = await channelRes.json();
  const channelName = channelData.channel?.name ?? event.item.channel;

  // 1순위: 메시지에 user_profile이 동봉돼 있으면 그걸 그대로 (users.info 호출도 안 필요)
  // 2순위: users.info 호출 (display_name 우선)
  const senderName =
    nameFromMessageProfile(message) ?? (await fetchSlackUserName(message.user, botToken));
  const resolvedText = await resolveSlackText(message.text ?? '', botToken);

  const slackUrl = `https://slack.com/archives/${event.item.channel}/p${event.item.ts.replace('.', '')}`;

  const { error: insertErr } = await supabase.from('tasks').insert({
    title: resolvedText.slice(0, 200) || '(슬랙 메시지)',
    source: 'slack',
    slack_url: slackUrl,
    slack_channel: channelName,
    slack_sender: senderName,
    requester: senderName,
    requested_at: new Date(parseFloat(message.ts) * 1000).toISOString(),
  });
  if (insertErr) {
    console.error('[slack/webhook] task insert failed', slackUrl, insertErr);
  } else {
    await broadcastTasksChanged('slack');
  }

  return NextResponse.json({ ok: true });
}
