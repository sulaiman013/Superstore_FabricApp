import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './top-products.dax?raw';
import spec from './top-products.json';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'DimProduct[product_name]': { name: 'DimProductproduct_name', displayName: 'Product' },
  '[Sales]': { name: 'Sales', displayName: 'Revenue', format: '$#,0' },
};

export function topProducts(filters: Filters) {
  return {
    connection,
    query: applyFilters(baseQuery, filters),
    columnMetadata,
    vegaLiteSpec: spec as VisualizationSpec,
  };
}
