import type { ReactNode } from 'react';
import { CircleDollarSign, Percent, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { kpis, type Filters } from '@/queries';
import { int, money0, money2, pct1 } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';

export function KpiRow({ filters }: { filters: Filters }) {
  const { connection, query } = kpis(filters);
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  if (data?.status === 'error') return <ErrorState message={data.error.message} />;

  const row = data?.status === 'success' ? data.table.rows[0] : undefined;
  const num = (i: number) => (row ? ((row[i] as number | null) ?? 0) : 0);
  const loading = isLoading || !row;

  const cards: { label: string; value: string; icon: ReactNode; accent?: boolean }[] = [
    { label: 'Total Sales', value: money0(num(0)), icon: <CircleDollarSign className="icon-size-300" />, accent: true },
    { label: 'Total Profit', value: money0(num(1)), icon: <TrendingUp className="icon-size-300" /> },
    { label: 'Transactions', value: int(num(2)), icon: <Receipt className="icon-size-300" /> },
    { label: 'Avg Basket', value: money2(num(3)), icon: <ShoppingBag className="icon-size-300" /> },
    { label: 'Margin', value: pct1(num(4)), icon: <Percent className="icon-size-300" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-l sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={cn('gap-m p-l', c.accent && 'border-transparent bg-primary text-primary-foreground')}
        >
          <span
            className={cn(
              'grid h-9 w-9 place-items-center rounded-lg',
              c.accent ? 'bg-white/15 text-primary-foreground' : 'bg-accent text-primary',
            )}
          >
            {c.icon}
          </span>
          <div>
            {loading ? (
              <div className={cn('h-8 w-24 animate-pulse rounded', c.accent ? 'bg-white/20' : 'bg-muted')} />
            ) : (
              <div className="font-numeric text-hero-700 leading-hero-700 tabular-nums">
                {c.value}
              </div>
            )}
            <div
              className={cn(
                'mt-xxs text-200',
                c.accent ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {c.label}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
