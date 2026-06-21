import { useState } from 'react';

import { DashboardHeader } from '@/components/dashboard-header';
import { FilterBar } from '@/components/filter-bar';
import { KpiRow } from '@/components/kpi-row';
import { ChartCard, type CrossFilter } from '@/components/chart-card';
import { TopCustomersCard } from '@/components/top-customers-card';
import { RecentOrdersCard } from '@/components/recent-orders-card';
import { RevenueTrendCard } from '@/components/revenue-trend-card';
import { DrillThroughCard } from '@/components/drill-through-card';
import { clearQueryCache } from '@/hooks/use-semantic-model-query';
import {
  EMPTY_FILTERS,
  paymentMix,
  salesByCategory,
  salesByRegion,
  topProducts,
  type Drill,
  type Filters,
} from '@/queries';

type CrossKey = 'categories' | 'regions' | 'payments';

function App() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    clearQueryCache('superstore');
    setReloadKey((k) => k + 1);
    window.setTimeout(() => setRefreshing(false), 700);
  };

  // Cross-filter: a chart click toggles that value into the matching filter.
  const xf = (key: CrossKey, field: string): CrossFilter => ({
    field,
    onToggle: (v) =>
      setFilters((f) => {
        const arr = f[key];
        const val = String(v);
        return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
      }),
    onClear: () => setFilters((f) => ({ ...f, [key]: [] })),
  });

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-l px-l py-xl">
        <DashboardHeader onRefresh={refresh} refreshing={refreshing} />
        <FilterBar filters={filters} onChange={setFilters} />

        <div key={reloadKey} className="flex flex-col gap-l">
          <KpiRow filters={filters} />

          <div className="grid grid-cols-1 gap-l lg:grid-cols-12">
            {drill && (
              <DrillThroughCard
                className="h-[460px] lg:col-span-12"
                drill={drill}
                filters={filters}
                onClose={() => setDrill(null)}
              />
            )}
            <RevenueTrendCard className="h-[340px] lg:col-span-8" filters={filters} />
            <ChartCard
              className="h-[340px] lg:col-span-4"
              title="Payment mix"
              subtitle="Click a slice to filter"
              result={paymentMix(filters)}
              crossFilter={xf('payments', 'FactSalespayment_method')}
            />
            <ChartCard
              className="h-[340px] lg:col-span-7"
              title="Top products"
              subtitle="Top 10 by revenue"
              result={topProducts(filters)}
            />
            <ChartCard
              className="h-[340px] lg:col-span-5"
              title="Sales by category"
              subtitle="Click a bar to filter"
              result={salesByCategory(filters)}
              crossFilter={xf('categories', 'DimProductcategory')}
            />
            <ChartCard
              className="h-[320px] lg:col-span-5"
              title="Sales by region"
              subtitle="Click a bar to filter"
              result={salesByRegion(filters)}
              crossFilter={xf('regions', 'DimCustomerregion')}
            />
            <TopCustomersCard
              className="h-[320px] lg:col-span-7"
              filters={filters}
              onDrill={setDrill}
            />
            <RecentOrdersCard
              className="h-[420px] lg:col-span-12"
              filters={filters}
              onDrill={setDrill}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
