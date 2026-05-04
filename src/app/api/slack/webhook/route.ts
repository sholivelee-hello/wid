import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import crypto from 'crypto';

async function verifySlackSignature(request: NextRequest, body: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const slackSignature = request.headers.get('x-slack-signature') ?? '';

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
}

// Slack user.info → 한국어 display name 우선. real_name(영문) → username → ID 순.
async function fetchSlackUserName(userId: string, botToken: string): Promise<string> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!data.ok) return userId;
    const profile = data.user?.profile;
    return (
      profile?.display_name?.trim() ||
      profile?.real_name?.trim() ||
      data.user?.real_name ||
      data.user?.name ||
      userId
    );
  } catch {
    return userId;
  }
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
  const payload = JSON.parse(body);

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
    await supabase.from('slack_events').insert({ event_id: eventId });

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

    return NextResponse.json({ ok: true });
  }

  if (event.type !== 'reaction_added') return NextResponse.json({ ok: true });

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
    console.error('[slack/webhook] dedup insert failed', eventId, dedupErr);
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

  const msgRes = await fetch(
    `https://slack.com/api/conversations.history?channel=${event.item.channel}&latest=${event.item.ts}&limit=1&inclusive=true`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const msgData = await msgRes.json();
  const message = msgData.messages?.[0];

  if (!message) return NextResponse.json({ ok: true });

  const channelRes = await fetch(
    `https://slack.com/api/conversations.info?channel=${event.item.channel}`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const channelData = await channelRes.json();
  const channelName = channelData.channel?.name ?? event.item.channel;

  const senderName = await fetchSlackUserName(message.user, botToken);
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
  }

  return NextResponse.json({ ok: true });
}
