import { entity, role, uuid, text, decimal, boolean } from '@microsoft/rayfin-core';

// The store catalog. unitPrice and discountPct are auto-applied at checkout.
// discountPct is a fraction (0.10 = 10% off).
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Product {
  @uuid() id!: string;
  @text({ max: 160 }) name!: string;
  @text({ max: 80 }) category!: string;
  @text({ max: 80 }) subCategory!: string;
  @decimal() unitPrice!: number;
  @decimal({ default: 0 }) discountPct!: number;
  @boolean({ default: true }) active!: boolean;
}
