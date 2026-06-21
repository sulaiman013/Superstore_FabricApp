# 02. Data: flat CSV to star schema to Direct Lake model

Prev: [01-fabric-setup.md](01-fabric-setup.md)

Goal: a denormalized flat CSV becomes a simple star schema in a Warehouse, then a Direct Lake semantic model with 5 measures. The transformation is deliberately simple (SELECT DISTINCT for dims, SELECT for the fact) to showcase "flat file evolves into a model".

## 1. The flat CSV (historical seed)

- File: `OUR DEMO APP/.../Karachi AI Community - Fabric Rayfin Talk/demo-data/superstore_sales_flat.csv` (relative to the talk folder: `demo-data/superstore_sales_flat.csv`).
- ~57,957 line items, 15,094 orders, 500 customers, 49 grocery products, 6 stores, **Jan 2015 to mid-June 2026 (YTD)**, with yearly growth + Eid/holiday seasonal peaks.
- Regenerate with `c:\tmp\gen_superstore.py` (`python gen_superstore.py`). Deterministic (seed 42). Date range and volume are set there (months loop 2015-2026, `base = 38 + (year-2015)*12`, `SEASONAL` peaks).
- Grain: one row per item scanned.

Columns: `order_id, order_timestamp, store, customer_id, customer_phone, customer_name, customer_segment, city, region, product_id, product_name, category, sub_category, quantity, unit_price, discount, sales, profit, payment_method`.
- `sales = quantity * unit_price * (1 - discount)`, `profit = quantity * unit_price * (margin - discount)`.

The product catalog and prices here MUST match App 1's seed catalog (`src/data/products.ts`) so live sales stay consistent with history.

## 2. Ingest into the Lakehouse

Upload `superstore_sales_flat.csv` to `Superstore_RawLH` Files, then Load-to-Tables (or COPY INTO the Warehouse) to create a staging table named **`stg_superstore`** with the columns above. Date column ingests as `datetime2`/`varchar` (both cast fine below).

## 3. Build the star schema (Fabric Warehouse T-SQL)

Run this in `Superstore_CleanedWH`. **Fabric Warehouse gotchas baked in:** no `nvarchar` (CAST `DATENAME` to `varchar`), no `FORMAT()` (compute `date_key` arithmetically), no `datetime` (use `date`/`datetime2`), `CREATE TABLE AS SELECT` is supported.

```sql
-- Re-runnable
DROP TABLE IF EXISTS FactSales;
DROP TABLE IF EXISTS DimCustomer;
DROP TABLE IF EXISTS DimProduct;
DROP TABLE IF EXISTS DimStore;
DROP TABLE IF EXISTS DimDate;

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
SELECT DISTINCT store AS store_name FROM stg_superstore;

-- DimDate is a FULL CALENDAR (2015-2030), NOT just dates-with-sales, so that
-- live self-checkout sales (today / future) always have a matching date_key.
-- (Fabric-safe: no recursive CTE; row source = any table with >= 5844 rows.)
CREATE TABLE DimDate AS
WITH nums AS (
    SELECT TOP (5844) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
    FROM stg_superstore
),
cal AS ( SELECT DATEADD(DAY, n, CAST('2015-01-01' AS date)) AS dt FROM nums )
SELECT
    YEAR(dt) * 10000 + MONTH(dt) * 100 + DAY(dt)     AS date_key,   -- e.g. 20260620, no FORMAT()
    dt                                               AS [date],
    YEAR(dt)                                         AS [year],
    MONTH(dt)                                        AS [month],
    CAST(DATENAME(MONTH, dt)   AS varchar(20))       AS month_name, -- CAST: no nvarchar in Fabric WH
    DATEPART(QUARTER, dt)                            AS [quarter],
    CAST(DATENAME(WEEKDAY, dt) AS varchar(20))       AS day_of_week
FROM cal;

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

Result: `DimCustomer, DimProduct, DimStore, DimDate, FactSales`.
Fabric Warehouse type rule of thumb: use `varchar`/`char`, `int`/`bigint`, `decimal`/`float`, `date`/`time`/`datetime2`. Avoid `nvarchar`, `text`, `money`, `datetime`, and `FORMAT()`.

## 4. Build the Direct Lake semantic model

Create `Superstore_Model` as Direct Lake on the `Superstore_CleanedWH` tables. Relationships:
- `FactSales[customer_id]` -> `DimCustomer[customer_id]`
- `FactSales[product_id]`  -> `DimProduct[product_id]`
- `FactSales[date_key]`    -> `DimDate[date_key]`
- `DimStore` is left **unrelated** (App 2 groups by the degenerate `FactSales[store]` column directly, so no store relationship is needed).

Add an empty **`_Measures`** table to hold the measures (a 1-column "Enter data" table, column hidden).

## 5. Add the 5 measures

In **DAX query view**, paste this and click each "Update model: Add new measure" CodeLens top to bottom (base measures before derived):

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

Or one-shot in **Tabular Editor** (C# script), which also sets format strings:
```csharp
var t = Model.Tables["_Measures"];
void M(string n, string e, string f){ var m=t.AddMeasure(n,e); m.FormatString=f; }
M("Total Sales",  "SUM ( FactSales[sales] )",                "$#,0.00");
M("Total Profit", "SUM ( FactSales[profit] )",               "$#,0.00");
M("Transactions", "DISTINCTCOUNT ( FactSales[order_id] )",   "#,0");
M("Avg Basket",   "DIVIDE ( [Total Sales], [Transactions] )","$#,0.00");
M("Margin %",     "DIVIDE ( [Total Profit], [Total Sales] )","0.0%");
```

Format strings (if set in DAX query view route): Total Sales / Total Profit / Avg Basket = `$#,0.00`, Transactions = `#,0`, Margin % = `0.0%`.

**These exact names are load-bearing for App 2's DAX:** `[Total Sales] [Total Profit] [Transactions] [Avg Basket] [Margin %]` and columns `DimProduct[category]`, `DimProduct[product_name]`, `DimCustomer[region]`, `DimCustomer[customer_name]`, `DimCustomer[customer_segment]`, `FactSales[payment_method]`, `DimDate[year]`, `DimDate[month]`.

→ Next: [03-app1-self-checkout.md](03-app1-self-checkout.md)
