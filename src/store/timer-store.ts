import { create } from 'zustand';

interface TimerState {
  activeTaskId: string | null;
  activeTimeLogId: string | null;
  startedAt: string | null;
  elapsed: number;
  intervalId: NodeJS.Timeout | null;

  startTimer: (taskId: string, timeLogId: string, startedAt: string) => void;
  stopTimer: () => void;
  tick: () => void;
  setFromServer: (taskId: string | null, timeLogId: string | null, startedAt: string | null) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTaskId: null,
  activeTimeLogId: null,
  startedAt: null,
  elapsed: 0,
  intervalId: null,

  startTimer: (taskId, timeLogId, startedAt) => {
    const prev = get().intervalId;
    if (prev) clearInterval(prev);

    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const intervalId = setInterval(() => get().tick(), 1000);

    set({ activeTaskId: taskId, activeTimeLogId: timeLogId, startedAt, elapsed, intervalId });
  },

  stopTimer: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ activeTaskId: null, activeTimeLogId: null, startedAt: null, elapsed: 0, intervalId: null });
  },

  tick: () => set((state) => ({ elapsed: state.elapsed + 1 })),

  setFromServer: (taskId, timeLogId, startedAt) => {
    if (taskId && startedAt) {
      get().startTimer(taskId, timeLogId!, startedAt);
    } else {
      get().stopTimer();
    }
  },
}));
