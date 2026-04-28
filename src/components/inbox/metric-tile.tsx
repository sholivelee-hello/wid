/**
 * MetricTile — Korean-IT hero metric card.
 * Visual pattern from Toss / KakaoBank / Today's House: large numeric value
 * as the primary glyph, label above (small, muted), optional hint below.
 * Tone applies to the number color so the eye locks onto state at a glance.
 */
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'destructive' | 'muted';

interface Props {
  label: string;
  value: number;
  tone?: Tone;
  hint?: string;
  unit?: string;
}

const toneClass: Record<Tone, string> = {
  primary: 'text-primary',
  destructive: 'text-destructive dark:text-rose-400',
  muted: 'text-muted-foreground/70 dark:text-muted-foreground/60',
};

export function MetricTile({ label, value, tone = 'primary', hint, unit = '' }: Props) {
  const effectiveTone: Tone = value === 0 ? 'muted' : tone;
  return (
    // min-w-0 + truncate enable graceful collapse in 3-up mobile grids where
    // a long label or 4-digit number would otherwise blow up the column.
    // is-hoverable triggers the surface-soft hover border bump so light-mode
    // cards have a tangible "I can interact with this" cue.
    <div className="surface-soft is-hoverable rounded-2xl px-4 py-4 sm:px-5 sm:py-5 min-w-0 transition-all duration-200 hover:-translate-y-px active:scale-[0.985] active:translate-y-0">
      {/* Overline label — uppercase + wide tracking, the editorial pattern. */}
      <p className="text-[9.5px] sm:text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground/65 truncate">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[32px] sm:text-[44px] font-extrabold leading-[0.95] tracking-[-0.04em] tabular-nums truncate',
          toneClass[effectiveTone],
        )}
      >
        {value}
        {unit && (
          <span className="text-[15px] sm:text-[18px] ml-1 font-semibold tracking-[-0.01em] text-muted-foreground/55">
            {unit}
          </span>
        )}
      </p>
      {hint && (
        <p className="mt-1.5 text-[10.5px] sm:text-[11px] text-muted-foreground/65 truncate tracking-[-0.005em]">{hint}</p>
      )}
    </div>
  );
}
