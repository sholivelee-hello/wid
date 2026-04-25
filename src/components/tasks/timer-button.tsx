'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, Save } from 'lucide-react';
import { useTimerStore } from '@/store/timer-store';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TimerButtonProps {
  taskId: string;
  actualDuration?: number | null;
  onTimerChange?: () => void;
  /** Use compact inline styling for cards. Default: false (for detail panel use). */
  compact?: boolean;
}

export function TimerButton({ taskId, onTimerChange, compact = false }: TimerButtonProps) {
  const { activeTaskId, elapsed, isPaused, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimerStore();
  const [loading, setLoading] = useState(false);
  const isActive = activeTaskId === taskId;
  const isRunning = isActive && !isPaused;
  const isPausedForThis = isActive && isPaused;

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await apiFetch<{ id: string; started_at: string }>(`/api/tasks/${taskId}/timer/start`, {
        method: 'POST', suppressToast: true,
      });
      startTimer(taskId, res.id, res.started_at);
      onTimerChange?.();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    pauseTimer();
  };

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    resumeTimer();
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await apiFetch(`/api/tasks/${taskId}/timer/stop`, { method: 'POST', suppressToast: true });
      stopTimer();
      onTimerChange?.();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const size = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (isActive) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <span className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1',
          isRunning ? 'bg-primary/10' : 'bg-amber-500/10',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {isRunning ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          ) : (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          )}
          <span className={cn(
            'font-mono tabular-nums font-medium',
            isRunning ? 'text-primary' : 'text-amber-600 dark:text-amber-400'
          )}>
            {formatElapsed(elapsed)}
          </span>
        </span>

        {/* Pause / Resume */}
        <Button
          variant="outline"
          size="sm"
          onClick={isPausedForThis ? handleResume : handlePause}
          disabled={loading}
          className={cn(size, 'p-0')}
          aria-label={isPausedForThis ? '타이머 재개' : '타이머 일시정지'}
          title={isPausedForThis ? '재개' : '일시정지'}
        >
          {isPausedForThis
            ? <Play className={cn(iconSize, 'fill-current')} />
            : <Pause className={iconSize} />}
        </Button>

        {/* Save */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={loading}
          className={cn(size, 'p-0 text-emerald-500 hover:text-emerald-600 hover:bg-accent')}
          aria-label="타이머 저장"
          title="저장"
        >
          {loading
            ? <Loader2 className={cn(iconSize, 'animate-spin')} />
            : <Save className={iconSize} />}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleStart}
      disabled={loading}
      className={cn(size, 'p-0 text-muted-foreground hover:bg-accent hover:text-foreground')}
      aria-label="타이머 시작"
      title="타이머 시작"
    >
      {loading ? <Loader2 className={cn(iconSize, 'animate-spin')} /> : <Play className={cn(iconSize, 'fill-current')} />}
    </Button>
  );
}
