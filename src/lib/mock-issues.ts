import { Issue } from './types';

const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const now = new Date().toISOString();

export const MOCK_ISSUES: Issue[] = [
  {
    id: id(1),
    name: '회원가입 플로우 개편',
    deadline: null,
    sort_mode: 'sequential',
    position: 0,
    notion_issue_id: 'notion-issue-001',
    created_at: now,
    is_deleted: false,
  },
  {
    id: id(2),
    name: '결제 모듈 리뷰',
    deadline: null,
    sort_mode: 'checklist',
    position: 1,
    notion_issue_id: null,
    created_at: now,
    is_deleted: false,
  },
];
