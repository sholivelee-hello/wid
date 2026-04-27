'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { TaskChipButton } from '@/components/tasks/task-chip-button';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextSundayIso(): string {
  const d = new Date();
  const dow = d.getDay();
  const add = dow === 0 ? 7 : 7 - dow;
  d.setDate(d.getDate() + add);
  return isoDate(d);
}

export function formatDeadlineLabel(deadline: string | null, fallback = '마감일'): string {
  if (!deadline) return fallback;
  const today = isoDate(new Date());
  if (deadline === today) return '오늘';
  const [, m, d] = deadline.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

interface Props {
  value: string | null;                 // yyyy-MM-dd
  onChange: (v: string | null) => void;
  triggerLabel?: string;                // default '마감일'
}

export function DeadlinePopover({ value, onChange, triggerLabel = '마감일' }: Props) {
  const [open, setOpen] = useState(false);
  const label = formatDeadlineLabel(value, triggerLabel);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <TaskChipButton
            active={value !== null}
            icon={<CalendarIcon className="h-3 w-3" />}
          >
            {label}
          </TaskChipButton>
        }
      />
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => { onChange(isoDate(new Date())); setOpen(false); }}
            >
              오늘
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                onChange(isoDate(d));
                setOpen(false);
              }}
            >
              내일
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => { onChange(nextSundayIso()); setOpen(false); }}
            >
              이번 주말
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              초기화
            </Button>
          </div>
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(d) => {
              if (d) {
                onChange(isoDate(d));
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
