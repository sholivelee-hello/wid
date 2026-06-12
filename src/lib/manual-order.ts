/**
 * 리스트 수동 정렬 overlay (2026-06-04 사용자 요청 — "잡아서 끌어올리기").
 *
 * DB의 `position`은 이슈 상세(부모별 checklist) 정렬이 주인이라, 전체(/inbox)
 * 평면 리스트와 오늘(/today) root 목록의 드래그 순서는 별도 overlay로
 * localStorage에 둔다 (1인용 앱 — today set과 같은 persistence 계층).
 *
 * 시맨틱: 저장된 배열 = 사용자가 원하는 순서의 task id 목록.
 * - 배열에 없는 항목(새 task)은 base 순서를 유지한 채 **맨 위**로 온다
 *   (인박스 최신-우선 관성 + 방금 추가한 게 바로 보이게).
 * - 삭제된 id는 적용 시 자연스럽게 걸러진다.
 */

export const INBOX_ORDER_KEY = 'wid-inbox-manual-order';
export const TODAY_ROOT_ORDER_KEY = 'wid-today-root-order';

export function loadManualOrder(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveManualOrder(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(ids));
}

/** base 리스트에 저장된 수동 순서를 입힌다. 알려진 항목은 저장 순서대로,
 *  모르는 항목(저장 후 새로 생긴 것)은 base 상대 순서 그대로 맨 위에. */
export function applyManualOrder<T extends { id: string }>(
  list: T[],
  order: string[],
): T[] {
  if (order.length === 0) return list;
  const idx = new Map(order.map((id, i) => [id, i] as const));
  const unknown: T[] = [];
  const known: T[] = [];
  for (const item of list) {
    if (idx.has(item.id)) known.push(item);
    else unknown.push(item);
  }
  known.sort((a, b) => idx.get(a.id)! - idx.get(b.id)!);
  return [...unknown, ...known];
}
