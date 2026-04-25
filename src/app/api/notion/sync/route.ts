import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Client } from '@notionhq/client';

export async function POST() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const supabase = createServerSupabaseClient();

  const { data: mappings } = await supabase.from('notion_status_mappings').select('*');
  const statusMap = new Map((mappings ?? []).map((m) => [m.notion_status, m.wid_status]));

  const response = await notion.dataSources.query({
    data_source_id: process.env.NOTION_DATABASE_ID!,
  });

  let created = 0;
  let updated = 0;

  for (const page of response.results) {
    if (!('properties' in page)) continue;
    const props = page.properties;

    const title = (props['이름'] ?? props['Name'] ?? props['제목'])?.type === 'title'
      ? ((props['이름'] ?? props['Name'] ?? props['제목']) as any).title?.[0]?.plain_text ?? ''
      : '';

    const notionStatus = (props['상태'] ?? props['Status'])?.type === 'status'
      ? ((props['상태'] ?? props['Status']) as any).status?.name ?? ''
      : '';

    const deadline = (props['마감일'] ?? props['Due'] ?? props['Deadline'])?.type === 'date'
      ? ((props['마감일'] ?? props['Due'] ?? props['Deadline']) as any).date?.start ?? null
      : null;

    const assignee = (props['담당자'] ?? props['Assignee'])?.type === 'people'
      ? ((props['담당자'] ?? props['Assignee']) as any).people?.[0]?.name ?? null
      : null;

    const widStatus = statusMap.get(notionStatus) ?? '대기';

    const { data: existing } = await supabase
      .from('tasks')
      .select('id, status, title, deadline')
      .eq('notion_task_id', page.id)
      .single();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (existing.title !== title) updates.title = title;
      if (existing.deadline !== deadline) updates.deadline = deadline;

      const defaultFromNotion = statusMap.get(notionStatus);
      if (defaultFromNotion && existing.status === defaultFromNotion) {
        // status unchanged from notion mapping - ok to update
      } else if (defaultFromNotion) {
        updates.status = widStatus;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('tasks').update(updates).eq('id', existing.id);
        updated++;
      }
    } else {
      await supabase.from('tasks').insert({
        title: title || '(제목 없음)',
        status: widStatus,
        source: 'notion',
        notion_task_id: page.id,
        deadline,
        requester: assignee,
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, total: response.results.length });
}
