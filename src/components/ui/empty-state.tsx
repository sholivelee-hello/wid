import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-slow">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-3" aria-hidden="true" />
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      {action && (
        <Link href={action.href}>
          <Button size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
