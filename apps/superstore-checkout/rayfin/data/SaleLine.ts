import { entity, role, uuid, text, decimal, int, one } from '@microsoft/rayfin-core';
import { Sale } from './Sale.js';
import { Product } from './Product.js';

// One product line within a Sale. Descriptive fields are snapshotted so each
// transaction is self-describing for downstream analytics.
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
