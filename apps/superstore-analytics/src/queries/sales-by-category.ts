import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './sales-by-category.dax?raw';
import spec from './sales-by-category.json';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'DimProduct[category]': { name: 'DimProductcategory', displayName: 'Category' },
  '[Sales]': { name: 'Sales', displayName: 'Revenue', format: '$#,0' },
  '[Profit]': { name: 'Profit', displayName: 'Profit', format: '$#,0' },
};

export function salesByCategory(filters: Filters) {
  return {
    connection,
    query: applyFilters(baseQuery, filters),
    columnMetadata,
    vegaLiteSpec: spec as VisualizationSpec,
  };
}
