import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import type {
  DataPointPredicate,
  InteractionEvent,
  SetPredicate,
} from '@microsoft/fabric-visuals-core';
import { DataGrid } from '@microsoft/fabric-datagrid';
import { useCssTheme } from '@microsoft/fabric-visuals';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { toDataTable } from '@/lib/to-data-table';
import { recentOrders, type Drill, type Filters } from '@/queries';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

/** First value of the named `set` predicate in a row-selection event. */
function pickSet(preds: readonly DataPointPredicate[], name: string): unknown {
  const p = preds.find((x) => x.type === 'set' && x.name === name) as
    | SetPredicate
    | undefined;
  return p?.values?.[0];
}

export function RecentOrdersCard({
  filters,
  className,
  onDrill,
}: {
  filters: Filters;
  className?: string;
  onDrill?: (drill: Drill | null) => void;
}) {
  const theme = useCssTheme();
  const { connection, query, columnMetadata } = recentOrders(filters);
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  const handleInteraction = (events: InteractionEvent[]) => {
    if (!onDrill) return;
    for (const e of events) {
      if (e.action === 'clear') {
        onDrill(null);
        continue;
      }
      for (const sel of e.selections) {
        const order = pickSet(sel.predicates, 'FactSalesorder_id');
        if (order == null) continue;
        const cust = pickSet(sel.predicates, 'DimCustomercustomer_name');
        const id = String(order);
        onDrill({
          kind: 'order',
          value: id,
          label: cust != null ? `${id} · ${String(cust)}` : id,
        });
      }
    }
  };

  const table =
    data?.status === 'success' ? toDataTable(data.table, columnMetadata) : null;

  let body: ReactNode;
  if (isLoading || !data) {
    body = <ChartSkeleton />;
  } else if (data.status === 'error') {
    body = <ErrorState message={data.error.message} />;
  } else if (!table || table.rows.length === 0) {
    body = <EmptyState message="No orders for the current filters" />;
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-auto">
        <DataGrid
          data={table}
          theme={theme}
          pageSize={10}
          defaultSort={[{ columnId: 'DimDatedate', direction: 'desc' }]}
          onInteraction={onDrill ? handleInteraction : undefined}
        />
      </div>
    );
  }

  const exportBtn =
    table && table.rows.length > 0 ? (
      <button
        onClick={() => downloadCsv(table, 'recent-orders.csv')}
        className="inline-flex items-center gap-s rounded-lg border bg-card px-m py-s-nudge text-200 font-medium transition-colors hover:bg-accent"
      >
        <Download className="icon-size-200 text-muted-foreground" />
        Export
      </button>
    ) : undefined;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader
        title="Recent orders"
        subtitle={
          onDrill
            ? 'Newest first. Click an order to see its items.'
            : 'Newest first. Sort, filter, and page through.'
        }
        action={exportBtn}
      />
      <div className="flex min-h-0 flex-1 flex-col px-s pb-m">{body}</div>
    </Card>
  );
}
