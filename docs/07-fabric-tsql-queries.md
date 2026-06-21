# 07. Fabric-optimized T-SQL (copy-paste reference)

Prev: [02-data-and-model.md](02-data-and-model.md) · [06-translytical-wiring.md](06-translytical-wiring.md)

Every T-SQL query for the build, in run order, so a fresh rebuild is pure copy-paste. **All of it runs in the Warehouse `Superstore_CleanedWH`** (SQL query editor) unless noted.

## Fabric Warehouse rules (why these are written this way)
- Use `varchar`/`char`, `int`/`bigint`, `decimal`/`float`, `date`/`time`/`datetime2`.
- **No `nvarchar`** -> `CAST(DATENAME(...) AS varchar(n))`.
- **No `FORMAT()`** -> compute `date_key` arithmetically (`YEAR*10000 + MONTH*100 + DAY`).
- **No `datetime`/`smalldatetime`** -> `CAST(... AS date)`.
- **No recursive CTE** for the calendar -> `TOP (n) ROW_NUMBER()` off any big table.
- `CREATE TABLE AS SELECT` (CTAS), views, and stored procedures are supported.

---

## STEP 0 · Ingest the flat CSV

Upload `demo-data/superstore_sales_flat.csv` to `Superstore_RawLH` Files, then Load-to-Tables (or COPY INTO) into the Warehouse as **`stg_superstore`**. Columns:

```
order_id, order_timestamp, store, customer_id, customer_phone, customer_name,
customer_segment, city, region, product_id, product_name, category, sub_category,
quantity, unit_price, discount, sales, profit, payment_method
```

---

## STEP 1 · Star schema (CTAS)

```sql
-- Re-runnable
DROP TABLE IF EXISTS FactSales;
DROP TABLE IF EXISTS DimCustomer;
DROP TABLE IF EXISTS DimProduct;
DROP TABLE IF EXISTS DimStore;
DROP TABLE IF EXISTS DimDate;

-- ---- dimensions ----
CREATE TABLE DimCustomer AS
SELECT DISTINCT
       CAST(customer_id    AS varchar(50))  AS customer_id,    -- wide enough for App 1's 36-char UUIDs (live shoppers)
       CAST(customer_phone AS varchar(40))  AS customer_phone,
       CAST(customer_name  AS varchar(120)) AS customer_name,
       customer_segment, city, region
FROM stg_superstore;

CREATE TABLE DimProduct AS
SELECT DISTINCT product_id, product_name, category, sub_category,
       CAST(unit_price AS decimal(10,2)) AS unit_price
FROM stg_superstore;

CREATE TABLE DimStore AS
SELECT DISTINCT store AS store_name
FROM stg_superstore;

-- DimDate = FULL CALENDAR 2015-2030 (NOT just dates-with-sales), so that live /
-- future self-checkout sales always have a matching date_key. 5844 = days from
-- 2015-01-01 to 2030-12-31. Row source = any table with >= 5844 rows.
CREATE TABLE DimDate AS
WITH nums AS (
    SELECT TOP (5844) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
    FROM stg_superstore
),
cal AS ( SELECT DATEADD(DAY, n, CAST('2015-01-01' AS date)) AS dt FROM nums )
SELECT
    YEAR(dt) * 10000 + MONTH(dt) * 100 + DAY(dt)     AS date_key,
    dt                                               AS [date],
    YEAR(dt)                                          AS [year],
    MONTH(dt)                                         AS [month],
    CAST(DATENAME(MONTH, dt)   AS varchar(20))        AS month_name,
    DATEPART(QUARTER, dt)                             AS [quarter],
    CAST(DATENAME(WEEKDAY, dt) AS varchar(20))        AS day_of_week
FROM cal;

-- ---- fact ----
CREATE TABLE FactSales AS
WITH src AS ( SELECT *, CAST(order_timestamp AS date) AS d FROM stg_superstore )
SELECT
    order_id,
    YEAR(d) * 10000 + MONTH(d) * 100 + DAY(d)  AS date_key,
    CAST(customer_id AS varchar(50)) AS customer_id,   -- match DimCustomer width; live UUIDs land here
    product_id, store,
    CAST(quantity   AS int)            AS quantity,
    CAST(unit_price AS decimal(10,2))  AS unit_price,
    CAST(discount   AS decimal(5,2))   AS discount,
    CAST(sales      AS decimal(12,2))  AS sales,
    CAST(profit     AS decimal(12,2))  AS profit,
    payment_method
FROM src;
```

Then build the **Direct Lake model `Superstore_Model`** on these tables (relationships: `FactSales[customer_id]->DimCustomer`, `[product_id]->DimProduct`, `[date_key]->DimDate`; `DimStore` unrelated). Add a hidden `_Measures` table.

---

## STEP 2 · DAX measures (model, run in DAX query view)

Not T-SQL, but required. Paste in DAX query view and click each "Add new measure" CodeLens top to bottom.

```dax
DEFINE
    MEASURE _Measures[Total Sales]  = SUM ( FactSales[sales] )
    MEASURE _Measures[Total Profit] = SUM ( FactSales[profit] )
    MEASURE _Measures[Transactions] = DISTINCTCOUNT ( FactSales[order_id] )
    MEASURE _Measures[Avg Basket]   = DIVIDE ( [Total Sales], [Transactions] )
    MEASURE _Measures[Margin %]     = DIVIDE ( [Total Profit], [Total Sales] )

EVALUATE
ROW (
    "Total Sales",  [Total Sales],  "Total Profit", [Total Profit],
    "Transactions", [Transactions], "Avg Basket",   [Avg Basket],
    "Margin %",     [Margin %]
)
```

One-shot alternative (Tabular Editor C#, also sets format strings):
```csharp
var t = Model.Tables["_Measures"];
void M(string n, string e, string f){ var m=t.AddMeasure(n,e); m.FormatString=f; }
M("Total Sales",  "SUM ( FactSales[sales] )",                 "$#,0.00");
M("Total Profit", "SUM ( FactSales[profit] )",                "$#,0.00");
M("Transactions", "DISTINCTCOUNT ( FactSales[order_id] )",    "#,0");
M("Avg Basket",   "DIVIDE ( [Total Sales], [Transactions] )", "$#,0.00");
M("Margin %",     "DIVIDE ( [Total Profit], [Total Sales] )", "0.0%");
```

---

## STEP 3 · Translytical wiring (after the shortcuts exist)

Prereq: in `Superstore_RawLH`, create OneLake shortcuts to App 1's mirrored `Sales` and `SaleLines` (App 1's tables are **plural**). Confirmed App 1 shapes:
- `Sales`: `id, customer_id, customerPhone, customerName, soldAt, subtotal, discountTotal, total, itemCount, paymentMethod` (`paymentMethod` lowercase: `card`/`cash`/`wallet`; `customerName` optional, captured at the kiosk, used to name the live shopper in analytics)
- `SaleLines`: `id, category, discountPct, lineTotal, productName, product_id, quantity, sale_id, unitPrice` (`product_id` is App 1's UUID; we map to the warehouse `product_id` by `productName`)

### 3a · Dry-run (read-only, confirm rows + non-null product_id + resolved customer)
```sql
SELECT
    sl.sale_id AS order_id,
    YEAR(s.soldAt)*10000 + MONTH(s.soldAt)*100 + DAY(s.soldAt) AS date_key,
    CAST(s.customer_id AS varchar(50)) AS customer_id,
    COALESCE(NULLIF(LTRIM(RTRIM(s.customerName)), ''), 'Walk-in ' + s.customerPhone) AS customer_name,
    dp.product_id,
    sl.lineTotal AS sales,
    CASE s.paymentMethod WHEN 'card' THEN 'Card' WHEN 'cash' THEN 'Cash' WHEN 'wallet' THEN 'Mobile Wallet' ELSE s.paymentMethod END AS payment_method
FROM [Superstore_RawLH].[dbo].[SaleLines] sl
JOIN [Superstore_RawLH].[dbo].[Sales] s ON sl.sale_id = s.id
LEFT JOIN DimProduct dp ON dp.product_name = sl.productName;
```

### 3b · Loader stored procedure (idempotent)
```sql
CREATE OR ALTER PROCEDURE dbo.usp_LoadLiveSales
AS
BEGIN
    -- 1) Upsert live shoppers into DimCustomer (keyed by App 1's customer id).
    --    Name is snapshotted on the Sale; fall back to "Walk-in <phone>".
    INSERT INTO DimCustomer
        (customer_id, customer_phone, customer_name, customer_segment, city, region)
    SELECT
        CAST(s.customer_id AS varchar(50)),
        CAST(MAX(s.customerPhone) AS varchar(40)),
        CAST(COALESCE(NULLIF(LTRIM(RTRIM(MAX(s.customerName))), ''), 'Walk-in ' + MAX(s.customerPhone)) AS varchar(120)),
        'Self-Checkout',                        -- segment marker for live shoppers
        NULL,                                   -- city unknown
        NULL                                    -- region unknown
    FROM [Superstore_RawLH].[dbo].[Sales] s
    WHERE NOT EXISTS (
        SELECT 1 FROM DimCustomer d WHERE d.customer_id = CAST(s.customer_id AS varchar(50))
    )
    GROUP BY CAST(s.customer_id AS varchar(50));   -- exactly one DimCustomer row per live shopper

    -- 2) Insert the new sale lines as facts, now LINKED to the customer (was NULL).
    INSERT INTO FactSales
        (order_id, date_key, customer_id, product_id, store, quantity, unit_price, discount, sales, profit, payment_method)
    SELECT
        sl.sale_id,
        YEAR(s.soldAt)*10000 + MONTH(s.soldAt)*100 + DAY(s.soldAt),
        CAST(s.customer_id AS varchar(50)),     -- links to DimCustomer (name now resolves)
        dp.product_id,                          -- mapped by name
        'Self-Checkout',
        CAST(sl.quantity    AS int),
        CAST(sl.unitPrice   AS decimal(10,2)),
        CAST(sl.discountPct AS decimal(5,2)),
        CAST(sl.lineTotal   AS decimal(12,2)),
        NULL,                                   -- App 1 has no profit
        CASE s.paymentMethod WHEN 'card' THEN 'Card' WHEN 'cash' THEN 'Cash' WHEN 'wallet' THEN 'Mobile Wallet' ELSE s.paymentMethod END
    FROM [Superstore_RawLH].[dbo].[SaleLines] sl
    JOIN [Superstore_RawLH].[dbo].[Sales] s ON sl.sale_id = s.id
    LEFT JOIN DimProduct dp ON dp.product_name = sl.productName
    WHERE NOT EXISTS (
        SELECT 1 FROM FactSales f WHERE f.order_id = sl.sale_id AND f.product_id = dp.product_id
    );
END;
```

### 3c · Backfill once + verify
```sql
EXEC dbo.usp_LoadLiveSales;

-- Confirm the live rows landed AND the customer name now resolves (was blank before).
SELECT f.order_id, f.date_key, c.customer_name, f.product_id, f.sales, f.payment_method
FROM FactSales f
LEFT JOIN DimCustomer c ON c.customer_id = f.customer_id
WHERE f.store = 'Self-Checkout';
```

### 3d · Schedule
New > Data pipeline > **Stored procedure** activity > connection `Superstore_CleanedWH`, proc `dbo.usp_LoadLiveSales` > Schedule every **1 minute**. (No stored-procedure activity? Use a **Script** activity with the `INSERT ... SELECT` body from 3b.) Then refresh `Superstore_Model` once; Direct Lake auto-updates after.

---

## Handy checks
```sql
-- row counts / totals
SELECT COUNT(*) AS fact_rows, SUM(sales) AS total_sales FROM FactSales;
-- inspect the shortcuts
SELECT TOP 5 * FROM [Superstore_RawLH].[dbo].[Sales];
SELECT TOP 5 * FROM [Superstore_RawLH].[dbo].[SaleLines];
-- date coverage (should span 2015-01-01 .. 2030-12-31)
SELECT MIN([date]) AS min_d, MAX([date]) AS max_d, COUNT(*) AS days FROM DimDate;
```

What goes live via the loop: Total Sales, Transactions, Avg Basket, Revenue-over-time, Sales-by-category, Top-products, Payment-mix, Recent-orders (now with the shopper's **name**), Top-customers (live shoppers appear, segment `Self-Checkout`), and the **purchase drill-through** (order×product line items). Historical-only (App 1 has no profit/region): Total Profit, Margin %, Sales-by-region.

The **drill-through** ("what did this customer/order buy") needs **no T-SQL change**: it reads `FactSales` at its natural order×product grain joined to `DimProduct`. The DAX + UI live in App 2, see [04-app2-analytics.md](04-app2-analytics.md).

Prev: [README.md](README.md)
