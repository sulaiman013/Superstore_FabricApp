# 04. App 2: Sales Analytics (analytical, read side)

Prev: [03-app1-self-checkout.md](03-app1-self-checkout.md)

Folder: `OUR DEMO APP/Superstore_Analytics`. Template: Rayfin **dataapp** (semantic-model-connected). Reads `Superstore_Model` via the **Execute DAX Queries API as the signed-in user**. Renders Vega-Lite charts + a DataGrid.

## The big simplification (read first)

The `dataapp` template handles auth natively: it queries the model **as the signed-in user** through an encoded token handshake. **No service principal, no fixed-identity cloud connection, no secret proxy.** (An earlier plan in DEMO-RUNBOOK history used executeQueries + a service principal; the native template makes all of that unnecessary.) Cost: a model-connected app **only runs inside the Fabric portal** (the standalone Open button errors the visual queries out).

## 0. Scaffold + register the connection
```bash
npm create @microsoft/rayfin@latest -- "Superstore_Analytics" --template dataapp --workspace "Karachi AI Community - Demo"
cd Superstore_Analytics
npx fabric-app-data add superstore --from-url "https://app.powerbi.com/groups/<YOUR_WORKSPACE_ID>/modeling/<YOUR_SEMANTIC_MODEL_ID>/modelView?experience=fabric-developer"
npx fabric-app-data generate -o src/fabric.generated.ts
```
This writes `fabric.yaml` (alias `superstore` -> workspace + model id) and `src/fabric.generated.ts`. No auth needed for `add`/`generate`.

## 1. The query layer pattern (the crux)

`src/queries/` holds, per visualization: a `.dax` (query), a `.json` (Vega-Lite spec), and a `.ts` factory returning `{ connection, query, columnMetadata, vegaLiteSpec }`.

**Filter injection.** Each `.dax` wraps its table in `CALCULATETABLE(...)` with a `/*__FILTERS__*/` placeholder. The query runs unfiltered as-is (it is a comment); the factory injects predicates. `src/queries/filters.ts`:
```ts
export interface Filters { categories: string[]; regions: string[]; payments: string[]; years: number[]; }
export const EMPTY_FILTERS: Filters = { categories: [], regions: [], payments: [], years: [] };
export function filtersActive(f: Filters){ return f.categories.length||f.regions.length||f.payments.length||f.years.length ? true : false; }
const lit = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function applyFilters(baseQuery: string, f: Filters): string {
  const parts: string[] = [];
  if (f.categories.length) parts.push(`DimProduct[category] IN {${f.categories.map(lit).join(', ')}}`);
  if (f.regions.length)    parts.push(`DimCustomer[region] IN {${f.regions.map(lit).join(', ')}}`);
  if (f.payments.length)   parts.push(`FactSales[payment_method] IN {${f.payments.map(lit).join(', ')}}`);
  if (f.years.length)      parts.push(`DimDate[year] IN {${f.years.join(', ')}}`);
  const injection = parts.length ? `,\n        ${parts.join(',\n        ')}` : '';
  return baseQuery.replace('/*__FILTERS__*/', injection);
}
```

**One full trio (copy this shape for every chart):**
```
// sales-by-category.dax
EVALUATE
CALCULATETABLE(
    SUMMARIZECOLUMNS(
        DimProduct[category],
        "Sales", [Total Sales],
        "Profit", [Total Profit]
    )
    /*__FILTERS__*/
)
ORDER BY [Sales] DESC
```
```json
// sales-by-category.json  (Vega-Lite v6; data:{} is filled by the `data` prop; fields are CLEANED names)
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "width": "container", "height": "container", "data": {},
  "mark": { "type": "bar", "cornerRadiusEnd": 3 },
  "encoding": {
    "x": { "field": "DimProductcategory", "type": "nominal", "sort": "-y", "title": null, "axis": { "labelAngle": -35 } },
    "y": { "field": "Sales", "type": "quantitative", "title": null },
    "tooltip": [ { "field": "DimProductcategory", "type": "nominal" }, { "field": "Sales", "type": "quantitative" }, { "field": "Profit", "type": "quantitative" } ]
  }
}
```
```ts
// sales-by-category.ts
import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { ColumnMetadataMap } from '@/lib/to-data-table';
import baseQuery from './sales-by-category.dax?raw';
import spec from './sales-by-category.json';
import { applyFilters, type Filters } from './filters';
const connection = 'superstore';
const columnMetadata: ColumnMetadataMap = {
  'DimProduct[category]': { name: 'DimProductcategory', displayName: 'Category' },
  '[Sales]':  { name: 'Sales',  displayName: 'Revenue', format: '$#,0' },
  '[Profit]': { name: 'Profit', displayName: 'Profit',  format: '$#,0' },
};
export function salesByCategory(filters: Filters) {
  return { connection, query: applyFilters(baseQuery, filters), columnMetadata, vegaLiteSpec: spec as VisualizationSpec };
}
```

**columnMetadata rules (do not guess):**
- Key = the **exact raw DAX output column name** (`SUMMARIZECOLUMNS` emits `Table[Column]` for group-bys and `[Alias]` for measure aliases). E.g. `DimProduct[category]`, `[Sales]`.
- `name` = that key with `. [ ] \ " '` removed -> the field id used in the Vega spec. `DimProduct[category]` -> `DimProductcategory`; `[Sales]` -> `Sales`.
- `displayName` -> axis titles, legend, tooltips, grid headers. `format` -> VBA/ECMA format string (`$#,0`, `0.0%`, `#,0`, `mmm yyyy`), flows into number/date formatting automatically. **Never use DAX `FORMAT()`; never hardcode `format` in the spec.**
- `?raw` import of `.dax` needs `src/dax.d.ts`: `declare module '*.dax?raw' { const content: string; export default content; }`.

**KPI pattern** (no Vega, read scalars): `kpis.dax` is `EVALUATE CALCULATETABLE(ROW("Total Sales",[Total Sales], ...) /*__FILTERS__*/)`. The component reads `data.table.rows[0][i]` by index (column order = ROW order).

**Filter options**: trivial `EVALUATE VALUES(DimProduct[category])` etc., inline in `src/queries/options.ts`; read distinct values from `rows.map(r => r[0])`.

Queries built (all in `src/queries/`): `kpis`, `revenue-trend` (**Year/Month/Day drill**: 3 `.dax` + 3 `.json` variants picked by a `grain` param; month builds `DATE(MAX(year),MAX(month),1)` as MonthStart on a temporal x; every variant filters `[Sales] > 0` and the temporal specs set `scale.nice:false` so the axis starts at 2015, not 2000), `sales-by-category` (bar), `top-products` (`TOPN(10, CALCULATETABLE(...))`, horizontal bar), `payment-mix` (arc/donut), `sales-by-region` (bar), `top-customers` (`TOPN(15,...)`, DataGrid), `recent-orders` (`TOPN(200, ... ORDER BY DimDate[date] DESC)`, order-grain detail for the DataGrid), `options`, `filters`, `index`.

## 2. SDK + component API

- `useSemanticModelQuery({ connection, query, bypassCache? })` -> `{ data, isLoading, error, refetch }`. **Never throws** -> branch on `data.status` (`'success' | 'error'`).
- `data.table`: `{ columns: { name, dataType }[], rows: unknown[][] }` — **row-major arrays of values**, aligned to columns by index. Dates arrive as ISO strings without TZ; BLANK -> null.
- `toDataTable(data.table, columnMetadata)` -> `DataTable` for the visuals.
- `import { VegaVisual, useCssTheme, type VisualizationSpec } from '@microsoft/fabric-visuals'`. `<VegaVisual spec={vegaLiteSpec} data={dataTable} theme={useCssTheme()} className="flex-1" />`. `theme` is REQUIRED.
- `import { DataGrid } from '@microsoft/fabric-datagrid'`. `<DataGrid data={dataTable} theme={theme} defaultSort={[{ columnId: 'Revenue', direction: 'desc' }]} />`. Column ids = cleaned `name`s.
- `clearQueryCache('superstore')` to force-refresh (then remount via a React `key`).

**Height chain (or charts squish):** grid cell with a definite height (`h-[340px]`) -> Card `h-full` flex-col -> content `flex-1 min-h-0` -> chart wrapper `flex flex-col flex-1 min-h-0 overflow-visible` -> `VegaVisual className="flex-1"`. Spec sets `width/height: "container"`.

## 3. Theme (Fluent tokens in `src/global.css`)

Keep the token NAMES (the visuals read `--color-brand`, `--color-brand-foreground`, `--color-hover`, mapped by `useCssTheme` into the chart theme; keep them hex). Use token utilities, not raw values: `bg-card`, `text-300`, `p-l`, `gap-m`, `rounded-xl`, `icon-size-200`, `font-numeric`. Dark mode = `.dark` class via `useAppTheme`; read the toggle with `useThemeContext()` (`{ isDark, toggleTheme }`). `main.tsx` already wires `ThemeContext.Provider` + `AuthGate` (which shows "can't open outside Fabric" when not embedded).

## 4. Components + App (in `src/components/`)

`dashboard-header` (title + Refresh + dark toggle), `filter-bar` (4 `MultiSelect`s fed by the option queries + chips + Clear all), `kpi-row` (5 cards from the KPI ROW; first card is a dark accent hero), `chart-card` (generic: factory result -> `useSemanticModelQuery` -> skeleton/empty/error -> `VegaVisual`; optional `crossFilter` prop), `revenue-trend-card` (Year/Month/Day drill toggle in the header), `top-customers-card` (`DataGrid`, optional `onDrill`), `recent-orders-card` (`DataGrid` + pagination + CSV export, optional `onDrill`), `drill-through-card` (the line-item detail panel), `ui/card`, `ui/multi-select`, `states`, `lib/format`, `lib/csv`. `src/App.tsx` composes: header, filter bar, then a `<div key={reloadKey}>` holding the KPI row + a `lg:grid-cols-12` chart grid (varied spans 8+4, 7+5, 5+7) + the customers grid + a full-width recent-orders table. It also holds a `drill: Drill | null` state; `setDrill` is passed to the two tables as `onDrill`, and the `DrillThroughCard` renders full-width at the top of the grid when `drill` is set. Refresh = `clearQueryCache('superstore')` + bump `reloadKey`. Copy the existing files.

## 4b. Rich features (lead-app parity)

- **Cross-filter on click.** `chart-card.tsx` wires `VegaVisual`'s `onInteraction`. A click emits `{action:'select', selections:[{predicates:[{type:'set', name:<cleaned field>, values:[v]}]}]}`; an empty-space click emits `{action:'clear'}`. Pass `crossFilter={{ field, onToggle, onClear }}`; the handler matches `predicate.name === field` and toggles `values[0]` into the matching filter array. Wired on category (`DimProductcategory` -> categories), region (`DimCustomerregion` -> regions), payment (`FactSalespayment_method` -> payments). Cross-filter clicks feed the same filter chips, so click-to-filter and the slicers share one state.
- **Multi-color categorical charts.** the category / region / payment specs add an explicit `color` encoding with a curated `scale.range` (Fluent accent palette); single-hue charts (trend, top-products) keep the theme brand color.
- **Hero KPI.** the first KPI card (Total Sales) is a dark accent card (`bg-primary text-primary-foreground`) for visual rhythm; the rest are neutral.
- **Detail table.** `recent-orders-card.tsx` shows the 200 newest orders in a `DataGrid` with `pageSize={10}` (pagination), built-in sort + per-column filter, and a **CSV export** button (`lib/csv.ts` -> `downloadCsv(dataTable, 'recent-orders.csv')`).
- **Date drill-down.** `revenue-trend-card.tsx` has a Year/Month/Day segmented toggle; the `revenueTrend(filters, grain)` factory swaps the `.dax`/`.json` variant. Day respects the Year slicer so it is not thousands of points. The x-axis used to stretch to 2000 because of a stray blank/zero row; fixed with `[Sales] > 0` in the DAX and `scale.nice:false` in the temporal specs.
- **Purchase drill-through (what did they buy).** Clicking a row in **Top customers** or **Recent orders** opens `drill-through-card.tsx`, a focused inline panel (not a modal) listing the order x product line items (Product, Category, Qty, Line total, Date, Store, Payment) plus a totals line and CSV export. The `DataGrid` row click fires `onInteraction` with one `set` predicate per column (`name` = cleaned column id); `pickSet(predicates, 'DimCustomercustomer_name')` opens a **customer** drill (everything they bought), `pickSet(predicates, 'FactSalesorder_id')` opens an **order** drill (that basket). Re-clicking the same row emits `{action:'clear'}` -> closes. The query is `src/queries/purchase-detail.{dax,ts}`: `SUMMARIZECOLUMNS` at order x product grain with a `/*__DRILL__*/` predicate injected alongside `/*__FILTERS__*/`, so global filters still apply. App.tsx holds the `drill` state; the panel auto-scrolls into view on open. **This is what surfaces the live Self-Checkout shopper's name and their exact items** (needs the [06](06-translytical-wiring.md) loop change that links `customer_id` and snapshots the name).
- **InteractionEvent types** (from `@microsoft/fabric-visuals-core`): `SelectInteractionEvent { action:'select'; selections: DataPointSelection[] }`, `DataPointSelection { predicates: (SetPredicate|RangePredicate)[] }`, `SetPredicate { type:'set'; name: string; values: unknown[] }`. The `name` is the cleaned field name.

## 5. Build, verify, deploy

```bash
npm run build        # fabric-app-data generate && tsc -b --noCheck && vite build  (note: --noCheck skips typecheck)
npx tsc -b           # OPTIONAL strict typecheck (the build does not check types)
```
**Verify the DAX (needs `az login`, since the build never executes queries):**
```bash
az login
npx fabric-app-data query superstore --query "EVALUATE INFO.VIEW.MEASURES()"   # confirm measure names match
npx fabric-app-data query superstore --file src/queries/sales-by-category.dax    # one real chart query
npx fabric-app-data query superstore --query "EVALUATE ROW(\"S\",[Total Sales],\"P\",[Total Profit],\"T\",[Transactions],\"B\",[Avg Basket],\"M\",[Margin %])"
```
If a measure/column name differs from what the factories assume, fix the `.dax` + the `columnMetadata` key.

**Deploy + view:**
```bash
npx rayfin login
npx rayfin up
```
Open App 2 **inside the Fabric portal** (model-connected apps are portal-only). The `AuthGate` handles sign-in automatically as the signed-in user.

→ Next: [05-demo-runbook.md](05-demo-runbook.md)
