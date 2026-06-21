// Lightweight formatters for KPI scalars (charts/grids format via columnMetadata).
const usd = (max: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: max,
  });

export const money0 = (n: number) => usd(0).format(n);
export const money2 = (n: number) => usd(2).format(n);
export const int = (n: number) => new Intl.NumberFormat('en-US').format(n);
export const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
