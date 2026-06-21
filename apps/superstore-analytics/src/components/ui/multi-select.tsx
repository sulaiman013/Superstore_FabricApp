import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiSelectProps<T extends string | number> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  loading?: boolean;
  format?: (v: T) => string;
}

export function MultiSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  loading,
  format,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const fmt = format ?? ((v: T) => String(v));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-s rounded-lg border bg-card px-m py-s-nudge text-200 transition-colors hover:bg-accent disabled:opacity-50',
          selected.length > 0 && 'border-primary/60',
        )}
      >
        <span className="font-medium">{label}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-primary px-s-nudge text-100 font-semibold tabular-nums text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="icon-size-100 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-30 mt-xs max-h-72 w-56 overflow-auto rounded-lg border bg-popover p-xs text-popover-foreground shadow-lg">
          {options.length === 0 && (
            <div className="px-s py-s text-200 text-muted-foreground">No options</div>
          )}
          {options.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={String(o)}
                type="button"
                onClick={() => toggle(o)}
                className="flex w-full items-center gap-s rounded-md px-s py-s text-left text-200 transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    'grid icon-size-200 place-items-center rounded border',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {on && <Check className="icon-size-100" />}
                </span>
                <span className="truncate">{fmt(o)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
