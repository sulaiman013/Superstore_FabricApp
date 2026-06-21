import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import yearlyQuery from './revenue-trend-yearly.dax?raw';
import monthlyQuery from './revenue-trend-monthly.dax?raw';
import dailyQuery from './revenue-trend-daily.dax?raw';
import yearlySpec from './revenue-trend-yearly.json';
import monthlySpec from './revenue-trend-monthly.json';
import dailySpec from './revenue-trend-daily.json';
import { applyFilters, type Filters } from './filters';

export type Grain = 'year' | 'month' | 'day';

const connection = 'superstore';
const sales = { name: 'Sales', displayName: 'Revenue', format: '$#,0' };

const META: Record<Grain, ColumnMetadataMap> = {
  year: { 'DimDate[year]': { name: 'DimDateyear', displayName: 'Year' }, '[Sales]': { ...sales } },
  month: { '[MonthStart]': { name: 'MonthStart', displayName: 'Month', format: 'mmm yyyy' }, '[Sales]': { ...sales } },
  day: { 'DimDate[date]': { name: 'DimDatedate', displayName: 'Date', format: 'yyyy-mm-dd' }, '[Sales]': { ...sales } },
};
const QUERY: Record<Grain, string> = { year: yearlyQuery, month: monthlyQuery, day: dailyQuery };
const SPEC: Record<Grain, unknown> = { year: yearlySpec, month: monthlySpec, day: dailySpec };

export function revenueTrend(filters: Filters, grain: Grain = 'month') {
  return {
    connection,
    query: applyFilters(QUERY[grain], filters),
    columnMetadata: META[grain],
    vegaLiteSpec: SPEC[grain] as VisualizationSpec,
  };
}
