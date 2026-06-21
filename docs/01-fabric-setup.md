# 01. Fabric setup, tenant settings, and the CLIs

Prev: [README.md](README.md)

## Capacity and region

- Use a **paid F capacity (F2 is the smallest)** in a **supported region**. **Central US works; East US is gated** for Fabric App (region-availability footnote). Reuse the existing lead-pipeline-app F2 / Central US capacity.
- A **SQL database in Fabric** needs the feature in **both** the tenant home region **and** the capacity region. A supported capacity region alone is not enough.

## Tenant settings (Admin portal, you are tenant admin)

| Setting | Where | Why |
|---|---|---|
| **Enable Fabric App Items (preview)** | Tenant settings > Microsoft Fabric | Lets users create Fabric Apps. Off by default. |
| **Users can create Fabric items** | Tenant settings > Microsoft Fabric | Umbrella Fabric switch. |
| **Semantic Model Execute Queries REST API** | Tenant settings > Integration settings | App 2 (`dataapp`) uses the Execute DAX Queries API to read the model. |

Deployed Fabric Apps authenticate with **Entra SSO only**. Email/password is local-dev only.

## The three CLIs (do not confuse them)

| CLI | Install | Purpose |
|---|---|---|
| `fab` (Microsoft Fabric CLI) | `pip install ms-fabric-cli` (Python 3.10+) | Authenticate to + inspect the Fabric estate. |
| `rayfin` (Rayfin CLI) | `npm i @microsoft/rayfin-cli` (per project) | Build + **deploy** an app (`rayfin up`). Has its OWN login. |
| `fabric-app-data` | bundled in the `dataapp` template | Register semantic-model connections + run DAX from the CLI (App 2 only). |

### `fab` essentials
```bash
fab --version
fab auth login        # menu -> "Interactive with a web browser" (NO device-code flow)
fab auth status       # who am I, which tenant
fab ls                # browse workspaces
```
`fab` does NOT deploy Rayfin apps. Rayfin has its own `rayfin login`. They are complementary.

### `rayfin` essentials
```bash
npm create @microsoft/rayfin@latest -- "<AppName>" --template <blankapp|todoapp|dataapp> --workspace "<workspace name>"
npx rayfin login
npx rayfin up                 # full deploy: Fabric App item + SQL DB + GraphQL Data API + Entra SSO + static hosting, applies schema migrations
npx rayfin up --dry-run       # preview, changes nothing
npx rayfin up db apply        # schema-only push
npx rayfin up staticapp deploy# frontend-only push
npx rayfin up status          # deployment health
```
Top-level verbs: **init, up, env, login, logout**. `login` also has `login status`. **There is NO `rayfin down`** (delete the Fabric App item in the portal to tear down).

### `fabric-app-data` essentials (App 2)
```bash
npx fabric-app-data add <alias> --from-url "<Power BI or Fabric model URL>"   # writes fabric.yaml (no auth)
npx fabric-app-data generate -o src/fabric.generated.ts                        # writes the TS config (no auth)
npx fabric-app-data query <alias> --query "<DAX>"                              # run DAX (needs `az login`)
npx fabric-app-data query <alias> --file src/queries/x.dax                     # run a .dax file
```
`add` and `generate` need no auth. `query` needs **Azure CLI signed in (`az login`)**. The `--from-url` parser accepts `modeling`, `semanticmodels`, `lakehouses`, `warehouses` URL segments.

## Workspace items to create (once)

In the workspace `Karachi AI Community - Demo`:
1. **Lakehouse** `Superstore_RawLH` (lands the raw CSV; gives a SQL analytics endpoint).
2. **Warehouse** `Superstore_CleanedWH` (the star schema, built with T-SQL).
3. **Semantic model** `Superstore_Model` (Direct Lake on the Warehouse tables; holds the measures).

→ Next: [02-data-and-model.md](02-data-and-model.md)
