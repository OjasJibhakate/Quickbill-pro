/**
 * Bill tax math, shared by the retail and restaurant billing flows.
 *
 * Indian restaurant billing adds tax ON TOP of the food value (GST is not
 * inclusive), and a service charge is added BEFORE GST:
 *   base = subtotal − discount
 *   serviceCharge = base × serviceRate%
 *   taxable = base + serviceCharge
 *   GST = taxable × gstRate%   (split evenly into CGST + SGST)
 *   grandTotal = taxable + GST
 */
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface TaxBreakdown {
  base: number; // subtotal − discount
  serviceCharge: number;
  taxable: number; // base + serviceCharge
  tax: number; // total GST
  halfTax: number; // CGST = SGST = tax / 2
  grandTotal: number;
  gstRate: number;
  serviceRate: number;
}

/** Computes the service charge + GST added on top of a discounted food value. */
export function computeTax(base: number, gstRateStr: string, serviceRateStr: string): TaxBreakdown {
  const gstRate = parseFloat(gstRateStr) || 0;
  const serviceRate = parseFloat(serviceRateStr) || 0;
  const serviceCharge = round2((Math.max(base, 0) * serviceRate) / 100);
  const taxable = Math.max(base, 0) + serviceCharge;
  const tax = round2((taxable * gstRate) / 100);
  return {
    base,
    serviceCharge,
    taxable,
    tax,
    halfTax: round2(tax / 2),
    grandTotal: round2(taxable + tax),
    gstRate,
    serviceRate,
  };
}

/**
 * Recovers the breakdown of a stored sale for display on the invoice, deriving
 * the effective rates from the amounts actually charged (so the bill is exact
 * even if the settings changed since).
 */
export function breakdownFromSale(sale: {
  totalAmount: number;
  discountAmount: number;
  serviceCharge?: number;
  taxAmount?: number;
}) {
  const base = sale.totalAmount - sale.discountAmount;
  const serviceCharge = sale.serviceCharge ?? 0;
  const taxable = base + serviceCharge;
  const tax = sale.taxAmount ?? 0;
  const serviceRate = base > 0 ? round2((serviceCharge / base) * 100) : 0;
  const gstRate = taxable > 0 ? round2((tax / taxable) * 100) : 0;
  return {
    base,
    serviceCharge,
    taxable,
    tax,
    halfTax: round2(tax / 2),
    serviceRate,
    gstRate,
  };
}
