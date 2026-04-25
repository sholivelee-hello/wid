import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Client } from '@notionhq/client';

const ASSIGNEE_FILTER = '이신희';

export async function POST() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const supabase = createServerSupabaseClient();

  const dbIds = [
    process.env.NOTION_DATABASE_ID_1,
    process.env.NOTION_DATABASE_ID_2,
  ].filter(Boolean) as string[];

  if (dbIds.length === 0) {
    return NextResponse.json(
      { error: 'NOTION_DATABASE_ID_1 환경변수가 설정되지 않았습니다.' },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  let total = 0;

  for (const dbId of dbIds) {
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      // @notionhq/client v5+ removed databases.query in favor of dataSources.query.
      // This branch still uses the legacy call shape; the runtime only executes when
      // NOTION_DATABASE_ID_* env vars are set, so dev/mock mode is unaffected.
      // Proper migration to dataSources is tracked separately.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (notion.databases as any).query({
        database_id: dbId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if (!('properties' in page)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = (page as any).properties;

        const title: string =
          (props['이름'] ?? props['Name'] ?? props['제목'])?.type === 'title'
            ? ((props['이름'] ?? props['Name'] ?? props['제목']) as any).title?.[0]?.plain_text ?? ''
            : '';

        const deadline: string | null =
          (props['마감일'] ?? props['Due'] ?? props['Deadline'])?.type === 'date'
            ? ((props['마감일'] ?? props['Due'] ?? props['Deadline']) as any).date?.start ?? null
            : null;

        const notionIssue: string | null =
          props['ISSUE']?.type === 'rich_text'
            ? (props['ISSUE'] as any).rich_text?.[0]?.plain_text ?? null
            : null;

        const assignees: string[] =
          (props['담당자'] ?? props['Assignee'])?.type === 'people'
            ? ((props['담당자'] ?? props['Assignee']) as any).people?.map((p: any) => p.name ?? '') ?? []
            : [];

        // Only sync tasks assigned to 이신희
        if (!assignees.includes(ASSIGNEE_FILTER)) continue;
        total++;

        const { data: existing } = await supabase
          .from('tasks')
          .select('id, title, deadline, notion_issue')
          .eq('notion_task_id', page.id)
          .single();

        if (existing) {
          const updates: Record<string, unknown> = {};
          if (title && existing.title !== title) updates.title = title;
          if (existing.deadline !== deadline) updates.deadline = deadline;
          if (existing.notion_issue !== notionIssue) updates.notion_issue = notionIssue;

          if (Object.keys(updates).length > 0) {
            await supabase.from('tasks').update(updates).eq('id', existing.id);
            updated++;
          }
        } else {
          await supabase.from('tasks').insert({
            title: title || '(제목 없음)',
            status: '대기',
            source: 'notion',
            notion_task_id: page.id,
            deadline,
            notion_issue: notionIssue,
            requester: ASSIGNEE_FILTER,
          });
          created++;
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }
  }

  return NextResponse.json({ created, updated, total });
}
