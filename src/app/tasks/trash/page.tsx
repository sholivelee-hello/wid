import { redirect } from 'next/navigation';

// 휴지통은 /inbox 보기 칩으로 흡수 (IA 단순화, spec 2026-06-03).
// 기존 북마크 호환을 위해 redirect만 남김.
export default function TrashRedirect() {
  redirect('/inbox?view=trash');
}
