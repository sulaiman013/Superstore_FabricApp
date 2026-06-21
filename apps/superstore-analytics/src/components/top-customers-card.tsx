import type { ReactNode } from 'react';
import type {
  DataPointPredicate,
  InteractionEvent,
  SetPredicate,
} from '@microsoft/fabric-visuals-core';
import { DataGrid } from '@microsoft/fabric-datagrid';
import { useCssTheme } from '@microsoft/fabric-visuals';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { toDataTable } from '@/lib/to-data-table';
import { topCustomers, type Drill, type Filters } from '@/queries';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';

/** First value of the named `set` predicate in a row-selection event. */
function pickSet(preds: readonly DataPointPredicate[], name: string): unknown {
  const p = preds.find((x) => x.type === 'set' && x.name === name) as
    | SetPredicate
    | undefined;
  return p?.values?.[0];
}

export function TopCustomersCard({
  filters,
  className,
  onDrill,
}: {
  filters: Filters;
  className?: string;
  onDrill?: (drill: Drill | null) => void;
}) {
  const theme = useCssTheme();
  const { connection, query, columnMetadata } = topCustomers(filters);
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  const handleInteraction = (events: InteractionEvent[]) => {
    if (!onDrill) return;
    for (const e of events) {
      if (e.action === 'clear') {
        onDrill(null);
        continue;
      }
      for (const sel of e.selections) {
        const name = pickSet(sel.predicates, 'DimCustomercustomer_name');
        if (name != null) {
          onDrill({ kind: 'customer', value: String(name), label: String(name) });
        }
      }
    }
  };

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
      <div className="min-h-0 flex-1 overflow-auto">
        <DataGrid
          data={dataTable}
          theme={theme}
          defaultSort={[{ columnId: 'Revenue', direction: 'desc' }]}
          onInteraction={onDrill ? handleInteraction : undefined}
        />
      </div>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader
        title="Top customers"
        subtitle={onDrill ? 'By revenue. Click a row for their purchases.' : 'By revenue'}
      />
      <div className="flex min-h-0 flex-1 flex-col px-s pb-m">{body}</div>
    </Card>
  );
}
