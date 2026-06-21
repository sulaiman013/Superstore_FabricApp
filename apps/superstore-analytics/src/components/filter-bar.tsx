import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  categoryOptions,
  filtersActive,
  paymentOptions,
  regionOptions,
  yearOptions,
  type Filters,
  type OptionQuery,
} from '@/queries';

function useOptions(q: OptionQuery) {
  const { data, isLoading } = useSemanticModelQuery(q);
  const values = useMemo(() => {
    if (data?.status !== 'success') return [] as (string | number)[];
    return data.table.rows
      .map((r) => r[0] as string | number | null)
      .filter((v): v is string | number => v != null);
  }, [data]);
  return { values, loading: isLoading };
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const cats = useOptions(categoryOptions());
  const regs = useOptions(regionOptions());
  const pays = useOptions(paymentOptions());
  const yrs = useOptions(yearOptions());

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const clearAll = () =>
    onChange({ categories: [], regions: [], payments: [], years: [] });

  const chips = [
    ...filters.categories.map((c) => ({
      key: `c-${c}`,
      label: c,
      remove: () => set({ categories: filters.categories.filter((x) => x !== c) }),
    })),
    ...filters.regions.map((c) => ({
      key: `r-${c}`,
      label: c,
      remove: () => set({ regions: filters.regions.filter((x) => x !== c) }),
    })),
    ...filters.payments.map((c) => ({
      key: `p-${c}`,
      label: c,
      remove: () => set({ payments: filters.payments.filter((x) => x !== c) }),
    })),
    ...filters.years.map((c) => ({
      key: `y-${c}`,
      label: String(c),
      remove: () => set({ years: filters.years.filter((x) => x !== c) }),
    })),
  ];

  return (
    <div className="flex flex-col gap-s">
      <div className="flex flex-wrap items-center gap-s">
        <span className="text-100 font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </span>
        <MultiSelect
          label="Category"
          options={cats.values as string[]}
          selected={filters.categories}
          loading={cats.loading}
          onChange={(v) => set({ categories: v })}
        />
        <MultiSelect
          label="Region"
          options={regs.values as string[]}
          selected={filters.regions}
          loading={regs.loading}
          onChange={(v) => set({ regions: v })}
        />
        <MultiSelect
          label="Payment"
          options={pays.values as string[]}
          selected={filters.payments}
          loading={pays.loading}
          onChange={(v) => set({ payments: v })}
        />
        <MultiSelect
          label="Year"
          options={yrs.values.map(Number)}
          selected={filters.years}
          loading={yrs.loading}
          onChange={(v) => set({ years: v })}
        />
        {filtersActive(filters) && (
          <button
            onClick={clearAll}
            className="ml-auto rounded-lg px-m py-s-nudge text-200 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-xs">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.remove}
              className="inline-flex items-center gap-xs rounded-full border border-primary/40 bg-primary/10 px-m py-xs text-100 font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {chip.label}
              <X className="icon-size-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
