import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-m px-l pb-s pt-l">
      <div className="min-w-0">
        <h2 className="text-300 font-semibold leading-300">{title}</h2>
        {subtitle && (
          <p className="text-200 leading-200 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}
