import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './sales-by-region.dax?raw';
import spec from './sales-by-region.json';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'DimCustomer[region]': { name: 'DimCustomerregion', displayName: 'Region' },
  '[Sales]': { name: 'Sales', displayName: 'Revenue', format: '$#,0' },
};

export function salesByRegion(filters: Filters) {
  return {
    connection,
    query: applyFilters(baseQuery, filters),
    columnMetadata,
    vegaLiteSpec: spec as VisualizationSpec,
  };
}
