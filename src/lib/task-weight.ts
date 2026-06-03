/**
 * 마감일 기반 시각 무게. priority 필드 폐기 후 인박스의 유일한 위계 기준.
 *  - heavy : 마감 지남 또는 오늘 → 크고 진하게 + 키컬러 라인
 *  - normal: 마감이 오늘+7일 이내
 *  - light : 마감 없음 또는 7일 초과 → 작고 흐리게
 * 처리된(완료/위임/취소) task는 기존 line-through 처리가 우선이므로
 * 호출부에서 isTaskDone일 때 'normal'로 고정해 무게 스타일을 끈다.
 * now는 호출부에서 mount 시점에 고정해 주입한다 (자정 넘김 시 카드 간 불일치 방지).
 */
export type TaskWeight = 'heavy' | 'normal' | 'light';

export function getTaskWeight(deadline: string | null, now: Date = new Date()): TaskWeight {
  if (!deadline) return 'light';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'heavy';
  if (diffDays <= 7) return 'normal';
  return 'light';
}
