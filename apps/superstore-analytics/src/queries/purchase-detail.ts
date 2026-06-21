import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './purchase-detail.dax?raw';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

// Order x product line items, named by their raw DAX output column.
const columnMetadata: ColumnMetadataMap = {
  'FactSales[order_id]': { name: 'FactSalesorder_id', displayName: 'Order' },
  'DimDate[date]': { name: 'DimDatedate', displayName: 'Date', format: 'yyyy-mm-dd' },
  'DimProduct[product_name]': { name: 'DimProductproduct_name', displayName: 'Product' },
  'DimProduct[category]': { name: 'DimProductcategory', displayName: 'Category' },
  'FactSales[store]': { name: 'FactSalesstore', displayName: 'Store' },
  'FactSales[payment_method]': { name: 'FactSalespayment_method', displayName: 'Payment' },
  '[Qty]': { name: 'Qty', displayName: 'Qty', format: '#,0' },
  '[LineTotal]': { name: 'LineTotal', displayName: 'Line total', format: '$#,0.00' },
};

/** What the drill-through is scoped to: one customer, or one order. */
export type Drill =
  | { kind: 'customer'; value: string; label: string }
  | { kind: 'order'; value: string; label: string };

const lit = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Line-item detail for a single customer (everything they bought) or a single
 * order (that basket's items). The drill predicate is injected into the same
 * CALCULATETABLE that carries the dashboard filters, so global filters still apply.
 */
export function purchaseDetail(drill: Drill, filters: Filters) {
  const predicate =
    drill.kind === 'customer'
      ? `DimCustomer[customer_name] = ${lit(drill.value)}`
      : `FactSales[order_id] = ${lit(drill.value)}`;
  const withDrill = baseQuery.replace('/*__DRILL__*/', `,\n        ${predicate}`);
  return { connection, query: applyFilters(withDrill, filters), columnMetadata };
}
