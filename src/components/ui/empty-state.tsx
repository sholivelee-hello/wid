import Link from 'next/link';
import { Button } from '@/components/ui/button';

type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

/**
 * Soft, hand-drawn-feeling illustration. Pure SVG so we don't ship a binary.
 * Two concentric arcs evoke a calm "all caught up" feel without leaning on
 * cartoon mascots — closer to Toss / Today's House empty states than to
 * cute illustrations that age badly.
 */
/**
 * Theme-aware illustration. Strokes use `currentColor` (text class) and the
 * accent path uses the primary color CSS variable so it adapts to dark mode
 * without us re-painting per theme.
 */
function CalmIllustration() {
  return (
    <svg
      width="144"
      height="96"
      viewBox="0 0 144 96"
      fill="none"
      aria-hidden="true"
      className="mb-6 text-muted-foreground/45 dark:text-border"
    >
      <defs>
        <linearGradient id="es-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.70" />
        </linearGradient>
      </defs>
      {/* Soft floor — uses currentColor + low opacity so it works on any bg */}
      <ellipse cx="72" cy="80" rx="56" ry="6" fill="currentColor" opacity="0.35" />
      <path
        d="M28 60 Q 72 12 116 60"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M44 60 Q 72 28 100 60"
        stroke="url(#es-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="3 5"
      />
      <circle cx="100" cy="60" r="4" fill="url(#es-accent)" />
      <circle cx="44" cy="60" r="3.5" fill="currentColor" opacity="0.7" />
      <rect
        x="62" y="62" width="20" height="14" rx="3"
        fill="var(--card)"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <line x1="66" y1="68" x2="78" y2="68" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round" />
      <line x1="66" y1="71" x2="74" y2="71" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon: _Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-6 text-center animate-soft-rise">
      <CalmIllustration />
      <h3 className="text-[17px] font-bold text-foreground mb-2 tracking-[-0.025em]">
        {title}
      </h3>
      {description && (
        <p className="text-[13.5px] text-muted-foreground mb-6 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button
              size="lg"
              className="rounded-full px-6 h-11 text-[14px] font-semibold transition-transform active:scale-[0.97]"
            >
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button
            size="lg"
            onClick={action.onClick}
            className="rounded-full px-6 h-11 text-[14px] font-semibold transition-transform active:scale-[0.97]"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
