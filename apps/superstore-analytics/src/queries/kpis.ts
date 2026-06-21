import baseQuery from './kpis.dax?raw';
import { applyFilters, type Filters } from './filters';

const connection = 'superstore';

/** Order matches the ROW() columns in kpis.dax. */
export const KPI_KEYS = [
  'totalSales',
  'totalProfit',
  'transactions',
  'avgBasket',
  'margin',
] as const;

export function kpis(filters: Filters) {
  return { connection, query: applyFilters(baseQuery, filters) };
}
