'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useTimerStore } from '@/store/timer-store';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TimerButtonProps {
  taskId: string;
  actualDuration?: number | null;
  onTimerChange?: () => void;
  /** Use compact inline styling for cards. Default: false (for detail panel use). */
  compact?: boolean;
}

export function TimerButton({ taskId, onTimerChange, compact = false }: TimerButtonProps) {
  const { activeTaskId, elapsed, startTimer, stopTimer } = useTimerStore();
  const [loading, setLoading] = useState(false);
  const isRunning = activeTaskId === taskId;

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await apiFetch<{ id: string; started_at: string }>(`/api/tasks/${taskId}/timer/start`, {
        method: 'POST', suppressToast: true
      });
      startTimer(taskId, res.id, res.started_at);
      toast.success('타이머 시작');
      onTimerChange?.();
    } catch {
      toast.error('타이머 시작에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await apiFetch(`/api/tasks/${taskId}/timer/stop`, { method: 'POST', suppressToast: true });
      stopTimer();
      toast.success('타이머 일시정지');
      onTimerChange?.();
    } catch {
      toast.error('타이머 정지에 실패했습니다');
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

  if (isRunning) {
    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <span className={cn(
          "flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1",
          compact ? "text-xs" : "text-sm"
        )}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span className="font-mono tabular-nums text-primary font-medium">{formatElapsed(elapsed)}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={loading}
          className={cn(size, "p-0")}
          aria-label="타이머 일시정지"
        >
          {loading ? <Loader2 className={cn(iconSize, "animate-spin")} /> : <Pause className={iconSize} />}
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
      className={cn(size, "p-0 text-muted-foreground hover:bg-accent hover:text-foreground")}
      aria-label="타이머 시작"
      title="타이머 시작"
    >
      {loading ? <Loader2 className={cn(iconSize, "animate-spin")} /> : <Play className={cn(iconSize, "fill-current")} />}
    </Button>
  );
}
