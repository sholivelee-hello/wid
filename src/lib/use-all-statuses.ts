'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_STATUSES } from '@/lib/constants';
import { useHiddenStatuses } from '@/lib/hidden-statuses';
import { useDefaultStatusRenames } from '@/lib/status-renames';
import { getStatusColor } from '@/lib/status-colors';
import { apiFetch } from '@/lib/api';
import type { CustomStatus } from '@/lib/types';

export interface StatusOption {
  /** DB에 저장되는 원본 값 */
  original: string;
  /** 화면에 표시되는 이름 */
  display: string;
  /** 상태 색상 (기본: constants/localStorage override, 커스텀: API color) */
  color: string;
  isCustom: boolean;
}

/**
 * DEFAULT_STATUSES(hidden 제외, rename 반영) + 커스텀 상태값을 합쳐서 반환.
 * 커스텀 상태의 색상은 API에서 직접 가져옴.
 */
export function useAllStatuses(): StatusOption[] {
  const hiddenStatuses = useHiddenStatuses();
  const defaultRenames = useDefaultStatusRenames();
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);

  useEffect(() => {
    apiFetch<CustomStatus[]>('/api/custom-statuses', { suppressToast: true })
      .then(data => setCustomStatuses(data))
      .catch(() => {});
  }, []);

  const defaults: StatusOption[] = DEFAULT_STATUSES
    .filter(s => !hiddenStatuses.has(s))
    .map(s => ({
      original: s,
      display: defaultRenames[s] ?? s,
      color: getStatusColor(s),
      isCustom: false,
    }));

  const customs: StatusOption[] = customStatuses.map(s => ({
    original: s.name,
    display: s.name,
    color: s.color || '#6B7280',
    isCustom: true,
  }));

  return [...defaults, ...customs];
}
