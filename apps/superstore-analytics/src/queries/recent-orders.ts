import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './recent-orders.dax?raw';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

const columnMetadata: ColumnMetadataMap = {
  'FactSales[order_id]': { name: 'FactSalesorder_id', displayName: 'Order' },
  'DimDate[date]': { name: 'DimDatedate', displayName: 'Date', format: 'yyyy-mm-dd' },
  'DimCustomer[customer_name]': { name: 'DimCustomercustomer_name', displayName: 'Customer' },
  'FactSales[store]': { name: 'FactSalesstore', displayName: 'Store' },
  'FactSales[payment_method]': { name: 'FactSalespayment_method', displayName: 'Payment' },
  '[Items]': { name: 'Items', displayName: 'Items', format: '#,0' },
  '[Total]': { name: 'Total', displayName: 'Total', format: '$#,0.00' },
};

export function recentOrders(filters: Filters) {
  return { connection, query: applyFilters(baseQuery, filters), columnMetadata };
}
