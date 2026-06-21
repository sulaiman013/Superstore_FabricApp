import { Moon, RefreshCw, Sun } from 'lucide-react';
import { useThemeContext } from '@/hooks/theme.context';
import { cn } from '@/lib/utils';

export function DashboardHeader({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { isDark, toggleTheme } = useThemeContext();

  return (
    <header className="flex flex-wrap items-center justify-between gap-m">
      <div>
        <h1 className="text-600 font-semibold leading-600 tracking-tight">
          Superstore Analytics
        </h1>
        <p className="text-200 leading-200 text-muted-foreground">
          Live from the Direct Lake semantic model
        </p>
      </div>

      <div className="flex items-center gap-s">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-s rounded-lg border bg-card px-m py-s-nudge text-200 font-medium transition-colors hover:bg-accent"
        >
          <RefreshCw
            className={cn('icon-size-200 text-muted-foreground', refreshing && 'animate-spin')}
          />
          Refresh
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="grid h-9 w-9 place-items-center rounded-lg border bg-card transition-colors hover:bg-accent"
        >
          {isDark ? <Sun className="icon-size-200" /> : <Moon className="icon-size-200" />}
        </button>
      </div>
    </header>
  );
}
