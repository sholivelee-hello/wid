import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/mock-data';
import { Client } from '@notionhq/client';

const ASSIGNEE_FILTER = '이신희';

const ISSUE_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#94a3b8',
];

function pickColor(notionIssueId: string): string {
  let hash = 0;
  for (let i = 0; i < notionIssueId.length; i++) {
    hash = ((hash << 5) - hash) + notionIssueId.charCodeAt(i);
    hash |= 0;
  }
  return ISSUE_PALETTE[Math.abs(hash) % ISSUE_PALETTE.length];
}

interface IssueRow {
  id: string;
  notion_issue_id: string;
  name: string;
}

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

async function ensureIssue(
  supabase: SupabaseClient,
  notionIssueId: string,
  title: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('issues')
    .select('id, name')
    .eq('notion_issue_id', notionIssueId)
    .maybeSingle();

  if (existing) {
    if (title && existing.name !== title) {
      await supabase
        .from('issues')
        .update({ name: title })
        .eq('id', (existing as IssueRow).id);
    }
    return (existing as IssueRow).id;
  }

  const { data: maxRow } = await supabase
    .from('issues')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    maxRow && typeof (maxRow as { position?: number }).position === 'number'
      ? (maxRow as { position: number }).position + 1
      : 0;

  const { data: inserted } = await supabase
    .from('issues')
    .insert({
      name: title || '(제목 없음)',
      color: pickColor(notionIssueId),
      sort_mode: 'checklist',
      position: nextPosition,
      notion_issue_id: notionIssueId,
    })
    .select('id')
    .single();

  return inserted?.id ?? null;
}

export async function POST() {
  if (isMockMode()) {
    return NextResponse.json({ skipped: 'mock mode', created: 0, updated: 0, total: 0 });
  }

  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const supabase = createServerSupabaseClient();

  const dbIds = [
    process.env.NOTION_DATABASE_ID_1,
    process.env.NOTION_DATABASE_ID_2,
  ].filter(Boolean) as string[];

  if (dbIds.length === 0) {
    return NextResponse.json(
      { error: 'NOTION_DATABASE_ID_1 환경변수가 설정되지 않았습니다.' },
      { status: 400 },
    );
  }

  let created = 0;
  let updated = 0;
  let total = 0;
  // Cache of resolved Notion ISSUE relation page ids → local Issue.id
  const issueIdMap = new Map<string, string | null>();
  // Cache of relation page id → title (lazy fetch via notion.pages.retrieve)
  const issueTitleCache = new Map<string, string>();

  const resolveIssueTitle = async (relationPageId: string): Promise<string> => {
    const hit = issueTitleCache.get(relationPageId);
    if (hit !== undefined) return hit;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any = await notion.pages.retrieve({ page_id: relationPageId });
      const props = page?.properties ?? {};
      const titleProp =
        props['이름'] ?? props['Name'] ?? props['제목'] ?? Object.values(props).find(
          (p: unknown) => (p as { type?: string })?.type === 'title',
        );
      const title: string =
        (titleProp as { type?: string })?.type === 'title'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? ((titleProp as any).title?.[0]?.plain_text ?? '')
          : '';
      issueTitleCache.set(relationPageId, title);
      return title;
    } catch {
      issueTitleCache.set(relationPageId, '');
      return '';
    }
  };

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ((props['이름'] ?? props['Name'] ?? props['제목']) as any).title?.[0]?.plain_text ?? ''
            : '';

        const deadline: string | null =
          (props['마감일'] ?? props['Due'] ?? props['Deadline'])?.type === 'date'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ((props['마감일'] ?? props['Due'] ?? props['Deadline']) as any).date?.start ?? null
            : null;

        // ISSUE may be either a rich_text label (legacy) or a relation to an
        // ISSUE database. Handle both: relation wins when present.
        const issueProp = props['ISSUE'] ?? props['이슈'] ?? props['Issue'];
        let notionIssueLabel: string | null = null;
        let issueRelationId: string | null = null;
        if (issueProp?.type === 'relation') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const relations = (issueProp as any).relation as { id: string }[] | undefined;
          if (relations && relations.length > 0) {
            issueRelationId = relations[0].id;
            const relTitle = await resolveIssueTitle(issueRelationId);
            notionIssueLabel = relTitle || null;
          }
        } else if (issueProp?.type === 'rich_text') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notionIssueLabel = (issueProp as any).rich_text?.[0]?.plain_text ?? null;
        }

        const assignees: string[] =
          (props['담당자'] ?? props['Assignee'])?.type === 'people'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ((props['담당자'] ?? props['Assignee']) as any).people?.map((p: any) => p.name ?? '') ?? []
            : [];

        // Only sync tasks assigned to 이신희
        if (!assignees.includes(ASSIGNEE_FILTER)) continue;
        total++;

        // Resolve the ISSUE relation to a local Issue id (create if needed)
        let localIssueId: string | null = null;
        if (issueRelationId) {
          if (issueIdMap.has(issueRelationId)) {
            localIssueId = issueIdMap.get(issueRelationId) ?? null;
          } else {
            localIssueId = await ensureIssue(
              supabase,
              issueRelationId,
              notionIssueLabel ?? '',
            );
            issueIdMap.set(issueRelationId, localIssueId);
          }
        }

        const { data: existing } = await supabase
          .from('tasks')
          .select('id, title, deadline, notion_issue, issue_id')
          .eq('notion_task_id', page.id)
          .single();

        if (existing) {
          const updates: Record<string, unknown> = {};
          if (title && existing.title !== title) updates.title = title;
          if (existing.deadline !== deadline) updates.deadline = deadline;
          if (existing.notion_issue !== notionIssueLabel) {
            updates.notion_issue = notionIssueLabel;
          }
          // Only override issue_id when Notion provides a relation; preserve
          // the user's local linking otherwise.
          if (issueRelationId && existing.issue_id !== localIssueId) {
            updates.issue_id = localIssueId;
            updates.parent_task_id = null;
          }

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
            notion_issue: notionIssueLabel,
            issue_id: localIssueId,
            requester: ASSIGNEE_FILTER,
          });
          created++;
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }
  }

  return NextResponse.json({
    created,
    updated,
    total,
    issuesResolved: issueIdMap.size,
  });
}
