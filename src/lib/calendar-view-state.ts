'use client';

import { useEffect, useState } from 'react';
import type { CalendarSubscription } from './types';

export const EMPTY_CALENDAR_SUBS: CalendarSubscription[] = [];

const STORAGE_KEY = 'wid-calendar-view-state';
const EVENT_NAME = 'calendar-view-state-changed';

export interface CalendarViewEntry {
  visible: boolean;
  color: string;
}
export type CalendarViewState = Record<string, CalendarViewEntry>;

function readState(): CalendarViewState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeState(state: CalendarViewState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function setCalendarVisible(id: string, visible: boolean): void {
  const state = readState();
  state[id] = { ...state[id], visible, color: state[id]?.color ?? '' };
  writeState(state);
}

export function setCalendarColor(id: string, color: string): void {
  const state = readState();
  state[id] = { visible: state[id]?.visible ?? true, color };
  writeState(state);
}

/** Merge stored state with defaults from subscriptions. */
function mergeWithDefaults(
  state: CalendarViewState,
  subscriptions: CalendarSubscription[]
): CalendarViewState {
  const merged: CalendarViewState = {};
  for (const sub of subscriptions) {
    merged[sub.id] = {
      visible: state[sub.id]?.visible ?? true,
      color: state[sub.id]?.color || sub.defaultColor,
    };
  }
  return merged;
}

export function useCalendarViewState(
  subscriptions: CalendarSubscription[]
): CalendarViewState {
  const [state, setState] = useState<CalendarViewState>(() =>
    mergeWithDefaults(readState(), subscriptions)
  );

  useEffect(() => {
    const update = () => setState(mergeWithDefaults(readState(), subscriptions));
    update();
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [subscriptions]);

  return state;
}

export function useCalendarVisible(id: string): boolean {
  const [visible, setVisible] = useState<boolean>(() => readState()[id]?.visible ?? true);
  useEffect(() => {
    const update = () => setVisible(readState()[id]?.visible ?? true);
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [id]);
  return visible;
}

export function useCalendarColor(
  id: string,
  subscriptions: CalendarSubscription[]
): string {
  const [color, setColor] = useState<string>(() => {
    const sub = subscriptions.find(s => s.id === id);
    return readState()[id]?.color || sub?.defaultColor || '#6B7280';
  });
  useEffect(() => {
    const update = () => {
      const sub = subscriptions.find(s => s.id === id);
      setColor(readState()[id]?.color || sub?.defaultColor || '#6B7280');
    };
    window.addEventListener(EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, [id, subscriptions]);
  return color;
}
