# Superstore Demo: Build Docs (chained)

Two Fabric Apps built with Rayfin, sharing one Direct Lake semantic model, that demonstrate the **translytical** loop end to end for the talk "End of Power BI? MS Fabric Apps with Rayfin".

These docs are a reproduction recipe. Follow them in order to rebuild both apps fast. Every load-bearing command, code block, and gotcha is captured so nothing has to be re-derived.

## The two apps

| App | Folder | Template | Role |
|---|---|---|---|
| **Self-Checkout** | `OUR DEMO APP/Superstore_App` | Rayfin `blankapp` | Operational. Writes sales to a Fabric SQL database. |
| **Sales Analytics** | `OUR DEMO APP/Superstore_Analytics` | Rayfin `dataapp` | Analytical. Reads the Direct Lake model via DAX, renders charts. |

## The loop (why this matters)

```
  App 1  Self-Checkout ──writes──► App 1 Fabric SQL DB ──auto-mirror──► OneLake (Delta)
  (Rayfin blankapp)                (Sales, SaleLines)                        │
                                                                            │ OneLake shortcut
  superstore_sales_flat.csv ─────► Lakehouse  Superstore_RawLH ◄────────────┘
       (2015-2026 historical)             │
                                          │ CTAS (history) + 1-min pipeline MERGE (live)
                                          ▼
                            Warehouse  Superstore_CleanedWH
                            FactSales = history + live  ·  DimDate = full calendar
                                          │
                                          ▼  Direct Lake (auto-update)
                            Model  Superstore_Model  ──Execute DAX (signed-in user)──►  App 2
                            (5 measures)                                                Sales Analytics
```

Stage line: *"App 1 is the operational layer. The Power BI semantic model is the analytics layer. Fabric mirrors one into the other automatically, so a sale I just rang up is already in the model. Power BI did not die; it moved to the center."*

## Key facts (this environment)

| Thing | Value |
|---|---|
| Workspace | `Karachi AI Community - Demo` = `<YOUR_WORKSPACE_ID>` |
| Capacity | F2, **Central US** (reused from lead-pipeline-app; East US is gated) |
| Lakehouse | `Superstore_RawLH` (+ its SQL analytics endpoint) |
| Warehouse | `Superstore_CleanedWH` (star schema) |
| Semantic model | `Superstore_Model` = `<YOUR_SEMANTIC_MODEL_ID>` |
| App 1 item id | `<YOUR_APP_BACKEND_ID>` (already deployed once) |
| App 2 connection alias | `superstore` (in `fabric.yaml`) |
| Tenant id | `<YOUR_TENANT_ID>` |
| Versions | App 1 rayfin `1.33.2`; App 2 rayfin `1.32`, fabric-app-data/visuals/datagrid `1.0.0` |
| Data | ~57,957 line items, Jan 2015 to Jun 2026 YTD; DimDate is a full 2015-2030 calendar |
| Translytical loop | wired via [06](06-translytical-wiring.md): OneLake shortcut + 1-min `usp_LoadLiveSales` pipeline into FactSales (verified 2026-06-20) |

## Status reality

Fabric Apps + Rayfin are **public preview** (Build 2026, June 2026). Direct Lake on OneLake is **GA (Mar 2026)**. SQL database in Fabric is **GA (Nov 2025)**. Re-check the region-availability page the morning of the talk.

## The chain

1. [01-fabric-setup.md](01-fabric-setup.md) — capacity, tenant settings, region gates, the CLIs (`fab`, `rayfin`, `fabric-app-data`).
2. [02-data-and-model.md](02-data-and-model.md) — flat CSV to Lakehouse to Warehouse star schema (Fabric-safe T-SQL) to Direct Lake model + the 5 measures.
3. [03-app1-self-checkout.md](03-app1-self-checkout.md) — scaffold, entities, services, checkout UI, deploy, seed, test sale.
4. [04-app2-analytics.md](04-app2-analytics.md) — connection, the DAX/Vega/factory query layer, components, build, verify, deploy.
5. [05-demo-runbook.md](05-demo-runbook.md) — the live demo sequence + the rebuild speed-run order + fallbacks.
6. [06-translytical-wiring.md](06-translytical-wiring.md) — wire App 1's live sales into App 2's model (the loop). REQUIRED for the live update to work; the two apps use separate stores by default.
7. [07-fabric-tsql-queries.md](07-fabric-tsql-queries.md) — every Fabric-optimized T-SQL query (star schema, DAX measures, translytical proc) in one copy-paste file.

## Speed-run order (rebuild from zero)

1. Confirm capacity + 3 tenant settings on (01).
2. Ingest `demo-data/superstore_sales_flat.csv` into the Lakehouse, run the star-schema CTAS in the Warehouse, build the Direct Lake model, add the 5 measures (02).
3. App 1: `npm create ... blankapp` to `Superstore_App`, drop in the 5 entity files + `store.ts` + `products.ts` + `CheckoutPage.tsx` + theme, `rayfin up`, seed catalog in-app, ring a test sale (03).
4. App 2: `npm create ... dataapp` to `Superstore_Analytics`, `fabric-app-data add superstore --from-url <model URL>` + `generate`, drop in `src/queries/*` + `src/components/*` + `App.tsx`, `npm run build`, `az login` + verify, `rayfin up`, open in portal (04).

→ Next: [01-fabric-setup.md](01-fabric-setup.md)
