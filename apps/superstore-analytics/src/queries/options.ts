// Filter-option queries. These are trivial VALUES() lookups that populate the
// slicers, so the DAX is kept inline rather than in separate .dax files.
const connection = 'superstore';

export interface OptionQuery {
  connection: string;
  query: string;
}

export const categoryOptions = (): OptionQuery => ({
  connection,
  query: 'EVALUATE VALUES(DimProduct[category]) ORDER BY DimProduct[category]',
});

export const regionOptions = (): OptionQuery => ({
  connection,
  query: 'EVALUATE VALUES(DimCustomer[region]) ORDER BY DimCustomer[region]',
});

export const paymentOptions = (): OptionQuery => ({
  connection,
  query: 'EVALUATE VALUES(FactSales[payment_method]) ORDER BY FactSales[payment_method]',
});

export const yearOptions = (): OptionQuery => ({
  connection,
  query: 'EVALUATE VALUES(DimDate[year]) ORDER BY DimDate[year]',
});
