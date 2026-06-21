import { useState, type ReactNode } from 'react';
import { VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { toDataTable } from '@/lib/to-data-table';
import { revenueTrend, type Filters, type Grain } from '@/queries';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';

const GRAINS: { id: Grain; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'day', label: 'Day' },
];

export function RevenueTrendCard({
  filters,
  className,
}: {
  filters: Filters;
  className?: string;
}) {
  const theme = useCssTheme();
  const [grain, setGrain] = useState<Grain>('month');
  const { connection, query, columnMetadata, vegaLiteSpec } = revenueTrend(filters, grain);
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  let body: ReactNode;
  if (isLoading || !data) {
    body = <ChartSkeleton />;
  } else if (data.status === 'error') {
    body = <ErrorState message={data.error.message} />;
  } else if (data.table.rows.length === 0) {
    body = <EmptyState />;
  } else {
    const dataTable = toDataTable(data.table, columnMetadata);
    body = (
      <div className="flex min-h-0 flex-1 flex-col overflow-visible">
        <VegaVisual spec={vegaLiteSpec} data={dataTable} theme={theme} className="flex-1" />
      </div>
    );
  }

  const drill = (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {GRAINS.map((g) => (
        <button
          key={g.id}
          onClick={() => setGrain(g.id)}
          className={cn(
            'rounded-md px-m py-xxs text-200 font-medium transition-colors',
            grain === g.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  );

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader
        title="Revenue over time"
        subtitle={grain === 'day' ? 'Daily (tip: pick a Year)' : `By ${grain}`}
        action={drill}
      />
      <div className="flex min-h-0 flex-1 flex-col px-s pb-m">{body}</div>
    </Card>
  );
}
