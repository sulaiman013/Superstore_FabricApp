// The seed catalog. Mirrors the historical superstore data so live sales stay
// consistent with the analytics model. discountPct is a fraction (0.10 = 10%).
export interface CatalogItem {
  name: string;
  category: string;
  subCategory: string;
  unitPrice: number;
  discountPct: number;
}

export const CATALOG: CatalogItem[] = [
  { name: 'Bananas 1kg', category: 'Produce', subCategory: 'Fruits', unitPrice: 1.2, discountPct: 0 },
  { name: 'Apples 1kg', category: 'Produce', subCategory: 'Fruits', unitPrice: 2.4, discountPct: 0 },
  { name: 'Tomatoes 1kg', category: 'Produce', subCategory: 'Vegetables', unitPrice: 1.8, discountPct: 0 },
  { name: 'Onions 1kg', category: 'Produce', subCategory: 'Vegetables', unitPrice: 0.95, discountPct: 0 },
  { name: 'Potatoes 2kg', category: 'Produce', subCategory: 'Vegetables', unitPrice: 2.1, discountPct: 0 },
  { name: 'Spinach Bunch', category: 'Produce', subCategory: 'Vegetables', unitPrice: 1.5, discountPct: 0 },
  { name: 'Carrots 1kg', category: 'Produce', subCategory: 'Vegetables', unitPrice: 1.3, discountPct: 0 },
  { name: 'Whole Milk 1L', category: 'Dairy & Eggs', subCategory: 'Milk', unitPrice: 1.1, discountPct: 0 },
  { name: 'Eggs (dozen)', category: 'Dairy & Eggs', subCategory: 'Eggs', unitPrice: 2.8, discountPct: 0 },
  { name: 'Cheddar Cheese 250g', category: 'Dairy & Eggs', subCategory: 'Cheese', unitPrice: 3.9, discountPct: 0 },
  { name: 'Greek Yogurt 500g', category: 'Dairy & Eggs', subCategory: 'Yogurt', unitPrice: 2.2, discountPct: 0 },
  { name: 'Butter 250g', category: 'Dairy & Eggs', subCategory: 'Butter', unitPrice: 2.6, discountPct: 0 },
  { name: 'White Bread', category: 'Bakery', subCategory: 'Bread', unitPrice: 1.4, discountPct: 0 },
  { name: 'Whole Wheat Bread', category: 'Bakery', subCategory: 'Bread', unitPrice: 1.7, discountPct: 0 },
  { name: 'Croissant 4pk', category: 'Bakery', subCategory: 'Pastry', unitPrice: 3.2, discountPct: 0 },
  { name: 'Bagels 6pk', category: 'Bakery', subCategory: 'Bread', unitPrice: 2.9, discountPct: 0 },
  { name: 'Orange Juice 1L', category: 'Beverages', subCategory: 'Juice', unitPrice: 2.5, discountPct: 0 },
  { name: 'Cola 2L', category: 'Beverages', subCategory: 'Soft Drinks', unitPrice: 1.9, discountPct: 0.05 },
  { name: 'Bottled Water 6pk', category: 'Beverages', subCategory: 'Water', unitPrice: 2.3, discountPct: 0 },
  { name: 'Coffee Beans 500g', category: 'Beverages', subCategory: 'Coffee', unitPrice: 7.5, discountPct: 0.15 },
  { name: 'Green Tea 50 bags', category: 'Beverages', subCategory: 'Tea', unitPrice: 3.6, discountPct: 0 },
  { name: 'Potato Chips 200g', category: 'Snacks', subCategory: 'Chips', unitPrice: 1.8, discountPct: 0 },
  { name: 'Chocolate Bar', category: 'Snacks', subCategory: 'Confectionery', unitPrice: 1.2, discountPct: 0 },
  { name: 'Mixed Nuts 300g', category: 'Snacks', subCategory: 'Nuts', unitPrice: 4.8, discountPct: 0.1 },
  { name: 'Cookies 300g', category: 'Snacks', subCategory: 'Biscuits', unitPrice: 2.1, discountPct: 0 },
  { name: 'Crackers 250g', category: 'Snacks', subCategory: 'Biscuits', unitPrice: 1.6, discountPct: 0 },
  { name: 'Frozen Pizza', category: 'Frozen', subCategory: 'Ready Meals', unitPrice: 4.5, discountPct: 0.2 },
  { name: 'Ice Cream 1L', category: 'Frozen', subCategory: 'Desserts', unitPrice: 3.8, discountPct: 0.15 },
  { name: 'Frozen Vegetables 1kg', category: 'Frozen', subCategory: 'Vegetables', unitPrice: 2.7, discountPct: 0 },
  { name: 'Frozen Fries 1kg', category: 'Frozen', subCategory: 'Potatoes', unitPrice: 2.4, discountPct: 0 },
  { name: 'Chicken Breast 1kg', category: 'Meat & Seafood', subCategory: 'Poultry', unitPrice: 6.9, discountPct: 0 },
  { name: 'Ground Beef 500g', category: 'Meat & Seafood', subCategory: 'Beef', unitPrice: 5.4, discountPct: 0 },
  { name: 'Salmon Fillet 400g', category: 'Meat & Seafood', subCategory: 'Fish', unitPrice: 8.9, discountPct: 0.1 },
  { name: 'Shrimp 500g', category: 'Meat & Seafood', subCategory: 'Seafood', unitPrice: 9.5, discountPct: 0 },
  { name: 'Basmati Rice 5kg', category: 'Pantry', subCategory: 'Grains', unitPrice: 9.8, discountPct: 0.1 },
  { name: 'Pasta 500g', category: 'Pantry', subCategory: 'Grains', unitPrice: 1.3, discountPct: 0 },
  { name: 'Olive Oil 1L', category: 'Pantry', subCategory: 'Oils', unitPrice: 7.2, discountPct: 0.15 },
  { name: 'Canned Beans 400g', category: 'Pantry', subCategory: 'Canned', unitPrice: 0.9, discountPct: 0 },
  { name: 'Breakfast Cereal 500g', category: 'Pantry', subCategory: 'Cereal', unitPrice: 3.4, discountPct: 0 },
  { name: 'Sugar 1kg', category: 'Pantry', subCategory: 'Baking', unitPrice: 1.1, discountPct: 0 },
  { name: 'Flour 2kg', category: 'Pantry', subCategory: 'Baking', unitPrice: 1.8, discountPct: 0 },
  { name: 'Dish Soap 500ml', category: 'Household', subCategory: 'Cleaning', unitPrice: 2.2, discountPct: 0 },
  { name: 'Laundry Detergent 2L', category: 'Household', subCategory: 'Cleaning', unitPrice: 6.4, discountPct: 0.2 },
  { name: 'Paper Towels 4pk', category: 'Household', subCategory: 'Paper', unitPrice: 3.1, discountPct: 0 },
  { name: 'Trash Bags 30pk', category: 'Household', subCategory: 'Paper', unitPrice: 2.8, discountPct: 0 },
  { name: 'Toothpaste 100ml', category: 'Personal Care', subCategory: 'Oral Care', unitPrice: 2.4, discountPct: 0 },
  { name: 'Shampoo 400ml', category: 'Personal Care', subCategory: 'Hair Care', unitPrice: 4.2, discountPct: 0.1 },
  { name: 'Hand Soap 250ml', category: 'Personal Care', subCategory: 'Bath', unitPrice: 1.9, discountPct: 0 },
  { name: 'Toilet Paper 12pk', category: 'Personal Care', subCategory: 'Paper', unitPrice: 5.6, discountPct: 0 },
];
