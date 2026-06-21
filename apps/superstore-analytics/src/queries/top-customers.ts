import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './top-customers.dax?raw';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'DimCustomer[customer_name]': { name: 'DimCustomercustomer_name', displayName: 'Customer' },
  'DimCustomer[customer_segment]': { name: 'DimCustomercustomer_segment', displayName: 'Segment' },
  'DimCustomer[region]': { name: 'DimCustomerregion', displayName: 'Region' },
  '[Revenue]': { name: 'Revenue', displayName: 'Revenue', format: '$#,0.00' },
  '[Orders]': { name: 'Orders', displayName: 'Orders', format: '#,0' },
};

export function topCustomers(filters: Filters) {
  return { connection, query: applyFilters(baseQuery, filters), columnMetadata };
}
