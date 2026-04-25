import { NextRequest, NextResponse } from 'next/server';
import { Issue } from '@/lib/types';
import { MOCK_ISSUES } from '@/lib/mock-issues';

// In-memory mutable copy for the dev-mock backend
let issues: Issue[] = [...MOCK_ISSUES];

export async function GET() {
  const visible = issues
    .filter(i => !i.is_deleted)
    .sort((a, b) => a.position - b.position);
  return NextResponse.json(visible);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Issue>;
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const maxPos = issues.reduce((m, i) => Math.max(m, i.position), -1);
  const next: Issue = {
    id: crypto.randomUUID(),
    name: body.name,
    color: body.color ?? '#94a3b8',
    deadline: body.deadline ?? null,
    sort_mode: (body.sort_mode === 'sequential' ? 'sequential' : 'checklist'),
    position: maxPos + 1,
    notion_issue_id: body.notion_issue_id ?? null,
    created_at: new Date().toISOString(),
    is_deleted: false,
  };
  issues.push(next);
  return NextResponse.json(next, { status: 201 });
}

// Helpers exposed for sibling routes (kept on the route module to share state in dev)
export const __issuesRef = () => issues;
export const __setIssues = (next: Issue[]) => { issues = next; };
