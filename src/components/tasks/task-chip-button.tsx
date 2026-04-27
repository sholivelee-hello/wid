'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskChipButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  active?: boolean;
  variant?: 'default' | 'destructive';
  icon?: React.ReactNode;
  /** Show right-side chevron (default true). */
  caret?: boolean;
  children: React.ReactNode;
  /** Optional trailing element rendered after the label (e.g. ISSUE unlink X). */
  trailing?: React.ReactNode;
}

export const TaskChipButton = forwardRef<HTMLButtonElement, TaskChipButtonProps>(
  function TaskChipButton(
    { active = false, variant = 'default', icon, caret = true, children, trailing, className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        className={cn(
          'h-7 px-2 rounded-full border text-[12px] inline-flex items-center gap-1 transition-colors max-w-[200px]',
          active
            ? 'border-foreground/30 text-foreground'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
          variant === 'destructive' && active && 'text-destructive border-destructive/40',
          variant === 'destructive' && !active && 'hover:text-destructive',
          className,
        )}
      >
        {icon && <span className="shrink-0 inline-flex">{icon}</span>}
        <span className="truncate">{children}</span>
        {caret && <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />}
        {trailing}
      </button>
    );
  },
);
