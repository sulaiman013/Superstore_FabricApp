import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Download, Receipt, User, X } from 'lucide-react';
import { DataGrid } from '@microsoft/fabric-datagrid';
import { useCssTheme } from '@microsoft/fabric-visuals';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { toDataTable } from '@/lib/to-data-table';
import { purchaseDetail, type Drill, type Filters } from '@/queries';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';
import { downloadCsv } from '@/lib/csv';
import { int, money2 } from '@/lib/format';

/**
 * Drill-through detail: the line items behind a single customer (everything
 * they bought) or a single order (that basket). Opened by clicking a row in
 * Top customers or Recent orders; an inline focused panel, not a modal.
 */
export function DrillThroughCard({
  drill,
  filters,
  onClose,
  className,
}: {
  drill: Drill;
  filters: Filters;
  onClose: () => void;
  className?: string;
}) {
  const theme = useCssTheme();
  const ref = useRef<HTMLDivElement>(null);
  const { connection, query, columnMetadata } = purchaseDetail(drill, filters);
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  // Bring the panel into view whenever the selection changes (the triggering
  // row may be far down the page).
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [drill.kind, drill.value]);

  const table =
    data?.status === 'success' ? toDataTable(data.table, columnMetadata) : null;

  const totals = useMemo(() => {
    if (!table) return null;
    const qi = table.columns.findIndex((c) => c.name === 'Qty');
    const ti = table.columns.findIndex((c) => c.name === 'LineTotal');
    let qty = 0;
    let amt = 0;
    for (const r of table.rows) {
      qty += Number(r[qi]) || 0;
      amt += Number(r[ti]) || 0;
    }
    return { lines: table.rows.length, qty, amt };
  }, [table]);

  let body: ReactNode;
  if (isLoading || !data) {
    body = <ChartSkeleton />;
  } else if (data.status === 'error') {
    body = <ErrorState message={data.error.message} />;
  } else if (!table || table.rows.length === 0) {
    body = <EmptyState message="No line items for this selection" />;
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-auto">
        <DataGrid
          data={table}
          theme={theme}
          pageSize={12}
          defaultSort={[{ columnId: 'DimDatedate', direction: 'desc' }]}
        />
      </div>
    );
  }

  const title =
    drill.kind === 'customer' ? `What ${drill.label} bought` : `Order ${drill.label}`;
  const subtitle =
    totals && totals.lines > 0
      ? `${int(totals.lines)} line items · ${int(totals.qty)} units · ${money2(totals.amt)}`
      : 'Line-item detail';

  const actions = (
    <div className="flex items-center gap-s">
      {table && table.rows.length > 0 && (
        <button
          onClick={() =>
            downloadCsv(
              table,
              `${drill.kind}-${drill.value}-items.csv`.replace(/[^\w.-]+/g, '_'),
            )
          }
          className="inline-flex items-center gap-s rounded-lg border bg-card px-m py-s-nudge text-200 font-medium transition-colors hover:bg-accent"
        >
          <Download className="icon-size-200 text-muted-foreground" />
          Export
        </button>
      )}
      <button
        onClick={onClose}
        aria-label="Close detail"
        className="inline-flex items-center gap-s rounded-lg border bg-card px-m py-s-nudge text-200 font-medium transition-colors hover:bg-accent"
      >
        <X className="icon-size-200 text-muted-foreground" />
        Close
      </button>
    </div>
  );

  return (
    <div ref={ref} className={className}>
      <Card className="h-full border-primary/50">
        <div className="flex items-center gap-s px-l pt-l">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary">
            {drill.kind === 'customer' ? (
              <User className="icon-size-200" />
            ) : (
              <Receipt className="icon-size-200" />
            )}
          </span>
          <span className="text-200 font-medium uppercase tracking-wide text-muted-foreground">
            Drill-through
          </span>
        </div>
        <CardHeader title={title} subtitle={subtitle} action={actions} />
        <div className="flex min-h-0 flex-1 flex-col px-s pb-m">{body}</div>
      </Card>
    </div>
  );
}
