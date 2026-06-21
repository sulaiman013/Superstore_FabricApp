import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './payment-mix.dax?raw';
import spec from './payment-mix.json';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'FactSales[payment_method]': { name: 'FactSalespayment_method', displayName: 'Payment method' },
  '[Sales]': { name: 'Sales', displayName: 'Revenue', format: '$#,0' },
};

export function paymentMix(filters: Filters) {
  return {
    connection,
    query: applyFilters(baseQuery, filters),
    columnMetadata,
    vegaLiteSpec: spec as VisualizationSpec,
  };
}
