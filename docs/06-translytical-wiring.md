# 06. Translytical wiring: make App 1 sales appear in App 2

Prev: [05-demo-runbook.md](05-demo-runbook.md)

## The gap

- **App 1** writes `Sale`/`SaleLine`/`Customer` to **its own Fabric SQL database** (the child SQL DB of the `Superstore_App` item). That DB auto-mirrors to OneLake.
- **App 2** reads `Superstore_Model`, built on a **different store**: the Warehouse `Superstore_CleanedWH` (historical CSV).

Two stores. The model never reads App 1's writes, so a sale rung in App 1 never reaches the dashboard. Fix = make the model's `FactSales` include App 1's live sales, unified with history. All steps run in Fabric (no app code changes).

## Prereq: verify App 1's mirrored table + column names

Open App 1's SQL database (the child item under `Superstore_App`) > SQL analytics endpoint. Confirm the table/column names. Expected (Rayfin maps entity classes/fields directly):
- `Sales`: `id, customer_id, customerPhone, customerName, soldAt, subtotal, discountTotal, total, itemCount, paymentMethod` (`customerName` optional, captured at the kiosk)
- `SaleLines`: `id, category, discountPct, lineTotal, productName, product_id, quantity, sale_id, unitPrice`

Confirmed 2026-06-20: Rayfin pluralizes the tables to `Sales` and `SaleLines`; `paymentMethod` values are lowercase (`card`/`cash`/`wallet`); App 1's `product_id` is its own UUID (we map to the warehouse `product_id` by `productName`).

## Step 1: rebuild DimDate as a full calendar (critical)

Live sales carry today's/future dates that are NOT in the CSV, so the date relationship would break. Make `DimDate` a continuous calendar (2015-2030). Run in `Superstore_CleanedWH` (Fabric-safe: no recursive CTE, no FORMAT, no nvarchar):

```sql
DROP TABLE IF EXISTS DimDate;
CREATE TABLE DimDate AS
WITH nums AS (
    SELECT TOP (5844) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
    FROM stg_superstore                         -- any table with >= 5844 rows
),
cal AS ( SELECT DATEADD(DAY, n, CAST('2015-01-01' AS date)) AS dt FROM nums )
SELECT
    YEAR(dt) * 10000 + MONTH(dt) * 100 + DAY(dt)      AS date_key,
    dt                                               AS [date],
    YEAR(dt)                                          AS [year],
    MONTH(dt)                                         AS [month],
    CAST(DATENAME(MONTH, dt)   AS varchar(20))        AS month_name,
    DATEPART(QUARTER, dt)                             AS [quarter],
    CAST(DATENAME(WEEKDAY, dt) AS varchar(20))        AS day_of_week
FROM cal;
```
(5844 = days from 2015-01-01 to 2030-12-31.)

## Step 2: shortcut App 1's sales into the Lakehouse

In `Superstore_RawLH` (Lakehouse) > Tables > **New shortcut** > **Microsoft OneLake** > select the `Superstore_App` SQL database item > pick its mirrored `Sales` and `SaleLines` tables. Name the shortcuts `Sales` and `SaleLines`. They now appear as tables in `Superstore_RawLH`, queryable from the Warehouse via the 3-part name `[Superstore_RawLH].[dbo].[Sales]`.

## Step 3: unify FactSales

Two ways to merge live + history. **Option B (micro-batch) is recommended for the demo: it keeps Direct Lake and definitely works.** Option A is instant but flips the fact to DirectQuery.

The live-to-FactSales mapping (shared by both): order_id = `sl.sale_id`; date_key from `s.soldAt`; `customer_id = s.customer_id` (the live shopper is **upserted into DimCustomer first**, so the name resolves; see 3c); `product_id` looked up by name (so the category relationship resolves); `store = 'Self-Checkout'`; `sales = sl.lineTotal`; `profit = NULL`; payment case-mapped to the historical values. **DimCustomer.customer_id / FactSales.customer_id must be `varchar(50)`** to hold App 1's 36-char UUIDs (cast in the star-schema CTAS, see [07](07-fabric-tsql-queries.md)).

### Option B (recommended): micro-batch MERGE into the Delta FactSales

Keep `FactSales` as a Delta table; a 1-minute pipeline appends new App-1 sales. Direct Lake auto-updates from the Delta change, so the dashboard reflects new sales within ~1 min. All SQL runs in `Superstore_CleanedWH`.

**3a. Verify App 1's column names** (adjust the SQL if they differ):
```sql
SELECT TOP 5 * FROM [Superstore_RawLH].[dbo].[Sales];
SELECT TOP 5 * FROM [Superstore_RawLH].[dbo].[SaleLines];
```

**3b. Dry-run the mapping** (read-only; confirm rows return, `product_id` is not null, and the customer resolves):
```sql
SELECT sl.sale_id AS order_id,
       YEAR(s.soldAt)*10000 + MONTH(s.soldAt)*100 + DAY(s.soldAt) AS date_key,
       CAST(s.customer_id AS varchar(50)) AS customer_id,
       COALESCE(NULLIF(LTRIM(RTRIM(s.customerName)), ''), 'Walk-in ' + s.customerPhone) AS customer_name,
       dp.product_id, sl.lineTotal AS sales
FROM [Superstore_RawLH].[dbo].[SaleLines] sl
JOIN [Superstore_RawLH].[dbo].[Sales] s ON sl.sale_id = s.id
LEFT JOIN DimProduct dp ON dp.product_name = sl.productName;
```

**3c. Create the loader stored procedure** (idempotent via NOT EXISTS). It first upserts the live shopper into `DimCustomer` (so the name resolves), then inserts the lines linked to that customer:
```sql
CREATE OR ALTER PROCEDURE dbo.usp_LoadLiveSales
AS
BEGIN
    -- 1) Upsert live shoppers into DimCustomer (name snapshotted on the Sale; fallback "Walk-in <phone>").
    INSERT INTO DimCustomer
        (customer_id, customer_phone, customer_name, customer_segment, city, region)
    SELECT
        CAST(s.customer_id AS varchar(50)),
        CAST(MAX(s.customerPhone) AS varchar(40)),
        CAST(COALESCE(NULLIF(LTRIM(RTRIM(MAX(s.customerName))), ''), 'Walk-in ' + MAX(s.customerPhone)) AS varchar(120)),
        'Self-Checkout', NULL, NULL
    FROM [Superstore_RawLH].[dbo].[Sales] s
    WHERE NOT EXISTS (
        SELECT 1 FROM DimCustomer d WHERE d.customer_id = CAST(s.customer_id AS varchar(50))
    )
    GROUP BY CAST(s.customer_id AS varchar(50));   -- exactly one DimCustomer row per live shopper

    -- 2) Insert the new lines as facts, LINKED to the customer (was NULL).
    INSERT INTO FactSales
        (order_id, date_key, customer_id, product_id, store, quantity, unit_price, discount, sales, profit, payment_method)
    SELECT
        sl.sale_id,
        YEAR(s.soldAt)*10000 + MONTH(s.soldAt)*100 + DAY(s.soldAt),
        CAST(s.customer_id AS varchar(50)),
        dp.product_id,
        'Self-Checkout',
        CAST(sl.quantity   AS int),
        CAST(sl.unitPrice  AS decimal(10,2)),
        CAST(sl.discountPct AS decimal(5,2)),
        CAST(sl.lineTotal  AS decimal(12,2)),
        NULL,
        CASE s.paymentMethod WHEN 'card' THEN 'Card' WHEN 'cash' THEN 'Cash' WHEN 'wallet' THEN 'Mobile Wallet' ELSE s.paymentMethod END
    FROM [Superstore_RawLH].[dbo].[SaleLines] sl
    JOIN [Superstore_RawLH].[dbo].[Sales] s ON sl.sale_id = s.id
    LEFT JOIN DimProduct dp ON dp.product_name = sl.productName
    WHERE NOT EXISTS (
        SELECT 1 FROM FactSales f WHERE f.order_id = sl.sale_id AND f.product_id = dp.product_id
    );
END;
```

**3d. Backfill once:** `EXEC dbo.usp_LoadLiveSales;`

**3e. Schedule every minute:** New > Data pipeline > add a **Stored procedure** activity > connection = `Superstore_CleanedWH`, proc = `dbo.usp_LoadLiveSales` > Schedule > repeat every 1 minute. (No Stored-procedure activity? Use a **Script** activity and paste the `INSERT ... SELECT` body.)

**3f.** Refresh `Superstore_Model` once; Direct Lake auto-updates thereafter. Narrate the ~1 min pipeline while it catches up.

### Option A (instant): FactSales as a view

Flips the fact to DirectQuery (live, zero lag), but Direct Lake can no longer "frame" that table; confirm the model accepts the view.

```sql
CREATE TABLE FactSalesHist AS SELECT * FROM FactSales;   -- preserve history
DROP TABLE FactSales;

CREATE VIEW FactSales AS
SELECT order_id, date_key, customer_id, product_id, store, quantity, unit_price, discount, sales, profit, payment_method
FROM FactSalesHist
UNION ALL
SELECT
    sl.sale_id,
    YEAR(s.soldAt) * 10000 + MONTH(s.soldAt) * 100 + DAY(s.soldAt),
    CAST(s.customer_id AS varchar(50)),
    dp.product_id,
    'Self-Checkout',
    sl.quantity,
    CAST(sl.unitPrice AS decimal(10,2)),
    CAST(sl.discountPct AS decimal(5,2)),
    CAST(sl.lineTotal AS decimal(12,2)),
    NULL,
    CASE s.paymentMethod WHEN 'card' THEN 'Card' WHEN 'cash' THEN 'Cash' WHEN 'wallet' THEN 'Mobile Wallet' ELSE s.paymentMethod END
FROM [Superstore_RawLH].[dbo].[SaleLines] sl
JOIN [Superstore_RawLH].[dbo].[Sales] s ON sl.sale_id = s.id
LEFT JOIN DimProduct dp ON dp.product_name = sl.productName;
```
A view cannot upsert, so run the `DimCustomer` insert from 3c (step 1) once, or on the same 1-minute schedule, for live names to resolve. If the model errors on the view (needs Delta), use Option B.

## Step 4: refresh the model + verify

- Refresh `Superstore_Model` (it now sees the unified `FactSales`). Relationships and measures are unchanged.
- Verify with `az login` then:
  `npx fabric-app-data query superstore --query "EVALUATE ROW(\"Txns\",[Transactions],\"Sales\",[Total Sales])"` before and after ringing a sale in App 1.

## What updates live vs historical-only

- **Live (updates when you ring a sale):** Total Sales, Transactions, Avg Basket, Revenue-over-time (all grains), Sales-by-category, Top-products, Payment-mix, Recent-orders.
- **Historical-only (App 1 does not capture these):** Total Profit, Margin %, Sales-by-region, Top-customers. To make these live too, use the "enrich App 1" approach (add region/segment/profit to App 1) instead.

## Demo flow

Ring a sale in App 1 -> the 1-min pipeline (Option B) or the live view (Option A) folds it into FactSales -> Direct Lake reflects it -> Refresh App 2 -> revenue/transactions/category/payment move. That is the translytical loop, end to end.

Prev: [README.md](README.md)
