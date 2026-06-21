import { entity, role, uuid, text, date, many } from '@microsoft/rayfin-core';
import { Sale } from './Sale.js';

// A shopper, identified at the kiosk by phone number (entered once per visit).
@entity()
@role('authenticated', ['create', 'read', 'update', 'delete'])
export class Customer {
  @uuid() id!: string;
  @text({ max: 40 }) phone!: string;
  @text({ optional: true, max: 120 }) name?: string;
  @date() createdAt!: Date;

  @many(() => Sale) sales?: Sale[];
}
