import { redirect } from 'next/navigation';

// 시작 화면 = 전체(/inbox) — "열면 전체부터 훑는다"는 사용자 사용 패턴 반영
// (2026-06-07 사용자 결정, 기존 /today 시작은 2026-06-03 IA 단순화 때 결정이었음).
export default function RootPage() {
  redirect('/inbox');
}
