import { Product } from './Product.js';
import { Customer } from './Customer.js';
import { Sale } from './Sale.js';
import { SaleLine } from './SaleLine.js';

export type SuperstoreSchema = {
  Product: Product;
  Customer: Customer;
  Sale: Sale;
  SaleLine: SaleLine;
};

export const schema = [Product, Customer, Sale, SaleLine];
