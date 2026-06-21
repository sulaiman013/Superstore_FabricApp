# 03. App 1: Self-Checkout (operational, write side)

Prev: [02-data-and-model.md](02-data-and-model.md)

Folder: `OUR DEMO APP/Superstore_App`. Template: Rayfin **blankapp** (auth + data services on, React 19 + Vite + Tailwind v4). Writes `Customer/Sale/SaleLine` to a Fabric SQL database that auto-mirrors to OneLake.

## 0. Scaffold
```bash
npm create @microsoft/rayfin@latest -- "Superstore_App" --template blankapp --workspace "Karachi AI Community - Demo"
cd Superstore_App
```
The blank app ships: `src/App.tsx` (router with `/auth` + `/` guarded), `src/pages/HomePage.tsx` (placeholder), `src/hooks/AuthContext.tsx` (`useAuth` -> `{user, signOut, isAuthenticated, loading}`), `src/services/{bootstrap,rayfinClient,MockAuthService,RayfinAuthService,IAuthService}.ts`, `rayfin/data/schema.ts` (empty), `src/main.css` (Tailwind v4 `@theme`).

## 1. Rayfin API cheat (v1.33.2)

**Decorators** (from `@microsoft/rayfin-core`): `entity, role, uuid, text, int, decimal, boolean, date, set, email, one, many`.
- `@entity()` + a permission decorator, always: `@role('authenticated', ['create','read','update','delete'])`.
- Fields: `@uuid()`, `@text({ max: N })` (ALWAYS set `max` on MSSQL), `@int()`, `@decimal({ default: 0 })`, `@boolean({ default: true })`, `@date()`, `@set('a','b')`, `@email({ unique: true })`. Optional: `@text({ optional: true, max: N })` + `?`.
- Relationships: FK column `@uuid() {prop}_id` PLUS `@one(() => Target) prop?`. Inverse `@many(() => Target)`. **Import entity classes with the `.js` extension** (`import { Sale } from './Sale.js'`).

**Client** (`getRayfinClient().data.<Entity>`):
- Read: `.select([...]).where({ field: { eq: v } }).orderBy({ col: 'asc' }).execute()`
- `.findFirst({ field: { eq: v } })`, `.findById(id)`
- **Create: pass the FK COLUMN, not the relationship object** -> `create({ customer_id: c.id, ... })`. (The v1.33.2 `MutationInput` type requires `customer_id`; passing `customer: { id }` fails typecheck.)
- `.update({ id }, { patch })`, `.delete({ id })`. **No `count()`** -> use `.execute().length`.

**Schema registration** (`rayfin/data/schema.ts`):
```ts
import { Product } from './Product.js';
import { Customer } from './Customer.js';
import { Sale } from './Sale.js';
import { SaleLine } from './SaleLine.js';
export type SuperstoreSchema = { Product: Product; Customer: Customer; Sale: Sale; SaleLine: SaleLine; };
export const schema = [Product, Customer, Sale, SaleLine];
```
Then change `BlankAppSchema` -> `SuperstoreSchema` in `src/services/rayfinClient.ts`, `MockAuthService.ts`, `RayfinAuthService.ts`.

## 2. Entities (`rayfin/data/`)

```ts
// Product.ts
import { entity, role, uuid, text, decimal, boolean } from '@microsoft/rayfin-core';
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Product {
  @uuid() id!: string;
  @text({ max: 160 }) name!: string;
  @text({ max: 80 }) category!: string;
  @text({ max: 80 }) subCategory!: string;
  @decimal() unitPrice!: number;
  @decimal({ default: 0 }) discountPct!: number;     // fraction, 0.10 = 10% off
  @boolean({ default: true }) active!: boolean;
}

// Customer.ts
import { entity, role, uuid, text, date, many } from '@microsoft/rayfin-core';
import { Sale } from './Sale.js';
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Customer {
  @uuid() id!: string;
  @text({ max: 40 }) phone!: string;
  @text({ optional: true, max: 120 }) name?: string;
  @date() createdAt!: Date;
  @many(() => Sale) sales?: Sale[];
}

// Sale.ts
import { entity, role, uuid, text, decimal, int, date, set, one, many } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';
import { SaleLine } from './SaleLine.js';
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Sale {
  @uuid() id!: string;
  @uuid() customer_id!: string;
  @one(() => Customer) customer?: Customer;
  @text({ max: 40 }) customerPhone!: string;
  @text({ optional: true, max: 120 }) customerName?: string;  // snapshot of the kiosk name -> names live sales in analytics
  @date() soldAt!: Date;
  @decimal() subtotal!: number;
  @decimal() discountTotal!: number;
  @decimal() total!: number;
  @int() itemCount!: number;
  @set('card', 'cash', 'wallet') paymentMethod!: 'card' | 'cash' | 'wallet';
  @many(() => SaleLine) lines?: SaleLine[];
}

// SaleLine.ts (descriptive fields snapshotted -> self-describing for analytics)
import { entity, role, uuid, text, decimal, int, one } from '@microsoft/rayfin-core';
import { Sale } from './Sale.js';
import { Product } from './Product.js';
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class SaleLine {
  @uuid() id!: string;
  @uuid() sale_id!: string;
  @one(() => Sale) sale?: Sale;
  @uuid() product_id!: string;
  @one(() => Product) product?: Product;
  @text({ max: 160 }) productName!: string;
  @text({ max: 80 }) category!: string;
  @int() quantity!: number;
  @decimal() unitPrice!: number;
  @decimal() discountPct!: number;
  @decimal() lineTotal!: number;
}
```

## 3. Services and data

- `src/data/products.ts` — the 49-item grocery catalog (`{name, category, subCategory, unitPrice, discountPct}`), mirrors the CSV; ~10 items carry a standing `discountPct`. Copy the existing file.
- `src/services/store.ts` — the data layer. Key shapes:
  - `getProducts()`: `client.data.Product.select([...]).where({ active: { eq: true } }).orderBy({ category: 'asc' }).execute()`.
  - `seedCatalog()`: if `Product.select(['id']).execute()` is empty, loop `client.data.Product.create({...})` for each catalog item. **Seed from inside the app** (signed in via Fabric SSO). Node seed scripts using email/password do NOT work against the deployed Fabric backend.
  - `findOrCreateCustomer(phone, name)`: `client.data.Customer.findFirst({ phone: { eq } })` else `create({ phone, ...(name?{name}:{}) , createdAt: new Date() })`.
  - `createSale(customer, cart, payment)`: `Sale.create({ customer_id: customer.id, customerPhone, ...(customer.name ? { customerName: customer.name } : {}), soldAt, subtotal, discountTotal, total, itemCount, paymentMethod })` then per line `SaleLine.create({ sale_id: sale.id, product_id: line.product.id, productName, category, quantity, unitPrice, discountPct, lineTotal })`. **FK columns, not relationship objects.** The `customerName` snapshot is what lets the translytical loop name the live shopper in App 2 (see [06](06-translytical-wiring.md) §3c); the kiosk already collects an optional name on the phone gate.
  - All functions branch on `isLocalBackend()` to use an in-memory store for offline preview.

## 4. Offline preview (the "vibe code, no cloud" beat)

- `src/services/PreviewAuthService.ts` — implements `IAuthService`, always returns a fake user (no backend).
- `src/services/bootstrap.ts` — add `const preview = import.meta.env.VITE_PREVIEW === '1'`; `localDev = isLocalBackendUrl(apiUrl) || preview`; return `new PreviewAuthService()` when `preview`.
- `.env.preview` -> `VITE_PREVIEW=1`. `package.json` script: `"dev:preview": "vite --mode preview"`.
- Run `npm run dev:preview` -> `http://localhost:5173`, full UI on in-memory data.

## 5. UI + theme

- `src/pages/CheckoutPage.tsx` — the checkout (copy the existing file). Steps state machine: `phone -> shop -> review -> done`. Phone gate (find-or-create customer), shop (searchable product list, tap to add, qty steppers, discount badges) with a sticky bottom summary bar (payment segmented control + running total + Checkout), review (totals + Finish payment), done (receipt + New sale). Loading skeletons / empty / error throughout.
- `src/main.css` — Tailwind v4 `@theme` tokens (OKLCH). Light theme, indigo accent (`--color-accent`), emerald savings/success, rose danger, tinted neutrals (never pure #fff/#000), `tabular-nums` on money. Copy the existing file.
- `src/App.tsx` — change the `/` route element from `<HomePage />` to `<CheckoutPage />`.

Design direction (impeccable, product register): light theme (kiosk under store lighting), Restrained palette + one committed indigo accent + 2 semantic colors, big tap targets, sticky POS summary bar, 150-250ms ease-out motion.

## 6. Build, deploy, seed, test
```bash
npm run build                 # tsc -b && vite build  -> must pass clean
npx rayfin login
npx rayfin up                 # applies the 4-table schema + deploys
```
Then in the **Fabric portal**: open App 1, sign in (Entra SSO), click **Load catalog** (seeds 49 products), ring a test sale. It writes `Sale` + `SaleLine` to Fabric SQL -> mirrors to OneLake. App 1 is SQL-connected (not model-connected), so it also opens fine standalone at its `*.webapp.fabricapps.net` URL.

→ Next: [04-app2-analytics.md](04-app2-analytics.md)
