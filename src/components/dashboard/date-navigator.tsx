'use client';

import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';

interface DateNavigatorProps {
  label: string;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onDateSelect: (date: Date) => void;
}

export function DateNavigator({ label, currentDate, onPrev, onNext, onDateSelect }: DateNavigatorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-lg font-semibold min-w-[180px]')}
        >
          {label}
          <CalendarIcon className="h-4 w-4 text-muted-foreground/70" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => { if (date) { onDateSelect(date); setOpen(false); } }}
          />
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => onDateSelect(new Date())} className="ml-3 text-xs h-7 px-2 border-primary/30 text-primary hover:bg-primary/10">
        오늘
      </Button>
    </div>
  );
}
