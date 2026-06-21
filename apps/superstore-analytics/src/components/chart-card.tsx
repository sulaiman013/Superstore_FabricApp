import type { ReactNode } from 'react';
import { VegaVisual, useCssTheme, type VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { toDataTable } from '@/lib/to-data-table';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';

export interface ChartResult {
  connection: string;
  query: string;
  columnMetadata: ColumnMetadataMap;
  vegaLiteSpec: VisualizationSpec;
}

/** Maps a chart click to a filter dimension (cross-filtering). */
export interface CrossFilter {
  field: string; // cleaned field name in the spec, e.g. "DimProductcategory"
  onToggle: (value: string | number) => void;
  onClear: () => void;
}

interface ClickPredicate {
  type: string;
  name: string;
  values?: unknown[];
}
type ClickEvent =
  | { action: 'select'; selections: { predicates: ClickPredicate[] }[] }
  | { action: 'clear' };

export function ChartCard({
  title,
  subtitle,
  result,
  className,
  crossFilter,
}: {
  title: string;
  subtitle?: string;
  result: ChartResult;
  className?: string;
  crossFilter?: CrossFilter;
}) {
  const theme = useCssTheme();
  const { connection, query, columnMetadata, vegaLiteSpec } = result;
  const { data, isLoading } = useSemanticModelQuery({ connection, query });

  const handleInteraction = (events: ClickEvent[]) => {
    if (!crossFilter) return;
    for (const e of events) {
      if (e.action === 'clear') {
        crossFilter.onClear();
        continue;
      }
      for (const sel of e.selections) {
        for (const p of sel.predicates) {
          if (p.name === crossFilter.field && Array.isArray(p.values) && p.values.length) {
            crossFilter.onToggle(p.values[0] as string | number);
          }
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
      <div className="flex min-h-0 flex-1 flex-col overflow-visible">
        <VegaVisual
          spec={vegaLiteSpec}
          data={dataTable}
          theme={theme}
          className="flex-1"
          onInteraction={crossFilter ? handleInteraction : undefined}
        />
      </div>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col px-s pb-m">{body}</div>
    </Card>
  );
}
