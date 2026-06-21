// Dashboard filter state and the DAX filter-injection helper.
//
// Each `.dax` query contains a `/*__FILTERS__*/` placeholder inside a
// CALCULATETABLE(...). `applyFilters` replaces it with the active filter
// predicates, so a query runs unfiltered as-is (the placeholder is a comment)
// and filtered once the factory injects predicates.

export interface Filters {
  categories: string[];
  regions: string[];
  payments: string[];
  years: number[];
}

export const EMPTY_FILTERS: Filters = {
  categories: [],
  regions: [],
  payments: [],
  years: [],
};

export function filtersActive(f: Filters): boolean {
  return (
    f.categories.length > 0 ||
    f.regions.length > 0 ||
    f.payments.length > 0 ||
    f.years.length > 0
  );
}

const lit = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function applyFilters(baseQuery: string, f: Filters): string {
  const parts: string[] = [];
  if (f.categories.length) {
    parts.push(`DimProduct[category] IN {${f.categories.map(lit).join(', ')}}`);
  }
  if (f.regions.length) {
    parts.push(`DimCustomer[region] IN {${f.regions.map(lit).join(', ')}}`);
  }
  if (f.payments.length) {
    parts.push(`FactSales[payment_method] IN {${f.payments.map(lit).join(', ')}}`);
  }
  if (f.years.length) {
    parts.push(`DimDate[year] IN {${f.years.join(', ')}}`);
  }
  const injection = parts.length ? `,\n        ${parts.join(',\n        ')}` : '';
  return baseQuery.replace('/*__FILTERS__*/', injection);
}
