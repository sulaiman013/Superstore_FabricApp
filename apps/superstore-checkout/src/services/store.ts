// Operational data layer for the self-checkout app. Talks to the Rayfin data
// API when deployed to Fabric, and falls back to an in-memory store for the
// offline preview (`npm run dev:preview`) so the UI runs with no cloud.
import { getRayfinClient, isLocalBackend } from './rayfinClient';
import { CATALOG } from '@/data/products';

export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  unitPrice: number;
  discountPct: number;
  active: boolean;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'card' | 'cash' | 'wallet';

export interface SaleResult {
  id: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  itemCount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// ----- in-memory store (offline preview / local dev) ----------------------
let memProducts: Product[] | null = null;
const memCustomers: Customer[] = [];
let memSeq = 1;

function memCatalog(): Product[] {
  if (!memProducts) {
    memProducts = CATALOG.map((p, i) => ({ id: `mem-${i + 1}`, active: true, ...p }));
  }
  return memProducts;
}

// ----- catalog ------------------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  if (isLocalBackend()) return memCatalog();
  const rows = await getRayfinClient()
    .data.Product.select([
      'id', 'name', 'category', 'subCategory', 'unitPrice', 'discountPct', 'active',
    ])
    .where({ active: { eq: true } })
    .orderBy({ category: 'asc' })
    .execute();
  return rows as Product[];
}

/** Create the catalog the first time the app runs against an empty backend. */
export async function seedCatalog(): Promise<number> {
  if (isLocalBackend()) return memCatalog().length;
  const client = getRayfinClient();
  const existing = await client.data.Product.select(['id']).execute();
  if (existing.length > 0) return 0;
  let n = 0;
  for (const p of CATALOG) {
    await client.data.Product.create({
      name: p.name,
      category: p.category,
      subCategory: p.subCategory,
      unitPrice: p.unitPrice,
      discountPct: p.discountPct,
      active: true,
    });
    n += 1;
  }
  return n;
}

// ----- customer -----------------------------------------------------------
export async function findOrCreateCustomer(phone: string, name?: string): Promise<Customer> {
  const cleanPhone = phone.trim();
  const cleanName = name?.trim() || undefined;
  if (isLocalBackend()) {
    let c = memCustomers.find((x) => x.phone === cleanPhone);
    if (!c) {
      c = { id: `cust-${memSeq++}`, phone: cleanPhone, name: cleanName };
      memCustomers.push(c);
    }
    return c;
  }
  const client = getRayfinClient();
  const existing = await client.data.Customer.findFirst({ phone: { eq: cleanPhone } });
  if (existing) return existing as Customer;
  const created = await client.data.Customer.create({
    phone: cleanPhone,
    ...(cleanName ? { name: cleanName } : {}),
    createdAt: new Date(),
  });
  return created as Customer;
}

// ----- pricing ------------------------------------------------------------
export function priceLine(product: Product, quantity: number) {
  const gross = product.unitPrice * quantity;
  const discount = gross * product.discountPct;
  return { gross: r2(gross), discount: r2(discount), lineTotal: r2(gross - discount) };
}

export function summarize(cart: CartLine[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let itemCount = 0;
  for (const { product, quantity } of cart) {
    const gross = product.unitPrice * quantity;
    subtotal += gross;
    discountTotal += gross * product.discountPct;
    itemCount += quantity;
  }
  return {
    subtotal: r2(subtotal),
    discountTotal: r2(discountTotal),
    total: r2(subtotal - discountTotal),
    itemCount,
  };
}

// ----- sale ---------------------------------------------------------------
export async function createSale(
  customer: Customer,
  cart: CartLine[],
  paymentMethod: PaymentMethod,
): Promise<SaleResult> {
  const { subtotal, discountTotal, total, itemCount } = summarize(cart);

  if (isLocalBackend()) {
    return { id: `sale-${memSeq++}`, subtotal, discountTotal, total, itemCount };
  }

  const client = getRayfinClient();
  const sale = await client.data.Sale.create({
    customer_id: customer.id,
    customerPhone: customer.phone,
    ...(customer.name ? { customerName: customer.name } : {}),
    soldAt: new Date(),
    subtotal,
    discountTotal,
    total,
    itemCount,
    paymentMethod,
  });

  for (const { product, quantity } of cart) {
    const { lineTotal } = priceLine(product, quantity);
    await client.data.SaleLine.create({
      sale_id: sale.id,
      product_id: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      unitPrice: product.unitPrice,
      discountPct: product.discountPct,
      lineTotal,
    });
  }

  return { id: sale.id, subtotal, discountTotal, total, itemCount };
}
