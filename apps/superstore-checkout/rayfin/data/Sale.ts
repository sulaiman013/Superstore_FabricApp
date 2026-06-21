import { entity, role, uuid, text, decimal, int, date, set, one, many } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';
import { SaleLine } from './SaleLine.js';

// One completed checkout (a basket). The individual items live in SaleLine.
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Sale {
  @uuid() id!: string;

  @uuid() customer_id!: string;
  @one(() => Customer) customer?: Customer;

  @text({ max: 40 }) customerPhone!: string;
  // Snapshot of the shopper's name (optional at the kiosk), so each sale is
  // self-describing for analytics without joining back to Customer.
  @text({ optional: true, max: 120 }) customerName?: string;
  @date() soldAt!: Date;
  @decimal() subtotal!: number;
  @decimal() discountTotal!: number;
  @decimal() total!: number;
  @int() itemCount!: number;
  @set('card', 'cash', 'wallet') paymentMethod!: 'card' | 'cash' | 'wallet';

  @many(() => SaleLine) lines?: SaleLine[];
}
