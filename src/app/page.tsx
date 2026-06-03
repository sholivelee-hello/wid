import { redirect } from 'next/navigation';

// 시작 화면 = 오늘. 인박스는 /inbox로 이동 (IA 단순화, spec 2026-06-03).
export default function RootPage() {
  redirect('/today');
}
