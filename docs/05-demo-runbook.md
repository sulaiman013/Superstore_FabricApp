# 05. Demo runbook + rebuild speed-run

Prev: [04-app2-analytics.md](04-app2-analytics.md)

## Live demo

The full stage sequence (beats, talking points, timing, fallbacks) lives in the talk-folder runbook: `../../DEMO-RUNBOOK.md` (`Karachi AI Community - Fabric Rayfin Talk/DEMO-RUNBOOK.md`). Use it for the actual session. This page is the rebuild recipe and the loop.

## The translytical loop (the payoff)

The loop is wired and verified (see [06-translytical-wiring.md](06-translytical-wiring.md)):

1. App 1: enter a phone, add items, finish payment -> writes `Sales` + `SaleLines` to App 1's Fabric SQL DB, which **auto-mirrors to OneLake** (~15s).
2. A **OneLake shortcut** in `Superstore_RawLH` exposes those mirrored tables to the Warehouse.
3. A **1-minute pipeline** (`usp_LoadLiveSales`) MERGEs the new sales into the Warehouse `FactSales` (product mapped to the warehouse id by name, payment case-mapped, date from `soldAt`; idempotent via NOT EXISTS).
4. The **Direct Lake model** auto-updates from the Delta change; App 2 (in the portal) **Refresh** lifts revenue, transactions, category, payment. End to end in ~1 minute.

What updates live: Total Sales, Transactions, Avg Basket, Revenue-over-time, Sales-by-category, Top-products, Payment-mix, Recent-orders. Historical-only (App 1 does not capture them): Profit, Margin, Sales-by-region, Top-customers.

## Rebuild speed-run (zero to both apps)

| Step | Command / action | Doc |
|---|---|---|
| 1 | Confirm F2/Central US + 3 tenant settings | [01](01-fabric-setup.md) |
| 2 | Ingest `demo-data/superstore_sales_flat.csv` -> Lakehouse -> Warehouse CTAS -> Direct Lake model + 5 measures | [02](02-data-and-model.md) |
| 3 | `npm create ...blankapp Superstore_App`; add entities + `store.ts` + `products.ts` + `CheckoutPage.tsx` + `main.css`; `npm run build`; `rayfin up`; Load catalog; test sale | [03](03-app1-self-checkout.md) |
| 4 | `npm create ...dataapp Superstore_Analytics`; `fabric-app-data add superstore --from-url <model>` + `generate`; add `src/queries/*` + `src/components/*` + `App.tsx` + `dax.d.ts`; `npm run build`; `az login` + verify; `rayfin up`; open in portal | [04](04-app2-analytics.md) |
| 5 | Wire the loop: full-calendar DimDate + OneLake shortcut to App 1's `Sales`/`SaleLines` + `usp_LoadLiveSales` on a 1-min pipeline | [06](06-translytical-wiring.md) |

The existing built apps are at `OUR DEMO APP/Superstore_App` and `OUR DEMO APP/Superstore_Analytics`. Fastest path tomorrow: reuse them as-is (both already build clean), redeploy with `rayfin up`, re-seed App 1, and re-verify App 2's DAX with `az login`.

## Gotcha index (the things that cost time)

- **Fabric Warehouse T-SQL:** no `nvarchar` (CAST `DATENAME` to `varchar`), no `FORMAT()` (arithmetic `date_key`), no `datetime` (use `date`/`datetime2`). [02]
- **Rayfin `create()`:** pass FK columns (`customer_id`), not relationship objects (`customer: {id}`) in v1.33.2. [03]
- **Rayfin entities:** `.js` import extension; `@text({ max })` always; `@role('authenticated', [...])` on every entity. [03]
- **App 1 seeding:** seed in-app (Fabric SSO), not via email/password Node scripts. [03]
- **App 2 auth:** native, signed-in user. NO service principal / fixed identity / proxy. [04]
- **App 2 portal-only:** model-connected apps can't open standalone (Open button errors). [04]
- **App 2 columnMetadata:** key by exact raw DAX column name; `name` = cleaned (strip `. [ ] \ " '`); fields in the Vega spec use the cleaned `name`. [04]
- **App 2 build:** `tsc -b --noCheck` does not typecheck; run `npx tsc -b` separately to catch type errors. [04]
- **App 2 verify:** the build never runs DAX; verify column/measure names with `az login` + `fabric-app-data query`. [04]
- **No `rayfin down`:** tear down by deleting the Fabric App item in the portal. [01]
- **Region:** Central US works, East US gated; SQL-in-Fabric needs the feature in tenant home region AND capacity region. [01]
- **Translytical = two stores:** App 1 writes its own SQL DB; the model reads the Warehouse. Unify via a OneLake shortcut + a 1-min MERGE pipeline into `FactSales`. [06]
- **DimDate must be a full calendar** (2015-2030), not just dates-with-sales, or live/future sale dates have no `date_key` to join. [02][06]
- **App 1's tables are plural** (`Sales`, `SaleLines`); `paymentMethod` is lowercase; App 1's `product_id` is a UUID, mapped to the warehouse `product_id` by `productName`. [06]

Prev: [README.md](README.md)
