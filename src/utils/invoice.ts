import { StoreProfile } from '@/context/StoreContext';

export interface InvoiceData {
  invoiceNo: string;
  date: string; // already formatted
  store: StoreProfile;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  paymentMethod: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  qrDataUrl?: string | null; // data:image/png;base64,... for the website QR
}

const inr = (n: number): string =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Builds a clean, printable HTML invoice for expo-print. */
export const buildInvoiceHtml = (d: InvoiceData): string => {
  const store = d.store;
  const storeName = store.name.trim() || 'QuickBill Pro';

  const rows = d.items
    .map(
      (it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="c">${it.quantity}</td>
        <td class="r">${inr(it.price)}</td>
        <td class="r">${inr(it.price * it.quantity)}</td>
      </tr>`
    )
    .join('');

  const customerBlock =
    d.customerName || d.customerPhone || d.customerAddress
      ? `<div class="party">
           <div class="label">BILL TO</div>
           ${d.customerName ? `<div class="pname">${esc(d.customerName)}</div>` : ''}
           ${d.customerPhone ? `<div class="muted">${esc(d.customerPhone)}</div>` : ''}
           ${d.customerAddress ? `<div class="muted">${esc(d.customerAddress)}</div>` : ''}
         </div>`
      : '';

  const contactLine = [store.phone, store.website].filter(Boolean).map(esc).join('  •  ');
  const gstNo = (store.gstNumber || '').trim();

  // Optional inclusive GST split, back-calculated from the total.
  const gstRate = parseFloat(store.gstRate || '') || 0;
  const showGst = gstRate > 0;
  const taxable = showGst ? d.total / (1 + gstRate / 100) : d.total;
  const halfTax = showGst ? (d.total - taxable) / 2 : 0;
  const gstRows = showGst
    ? `<div class="row"><span class="muted">Taxable value</span><span>${inr(taxable)}</span></div>
       <div class="row"><span class="muted">CGST @ ${gstRate / 2}%</span><span>${inr(halfTax)}</span></div>
       <div class="row"><span class="muted">SGST @ ${gstRate / 2}%</span><span>${inr(halfTax)}</span></div>`
    : '';

  const qrBlock = d.qrDataUrl
    ? `<div class="qr">
         <img src="${d.qrDataUrl}" width="110" height="110" />
         <div class="muted" style="margin-top:6px">Scan to visit our store</div>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 28px; }
  .header { background: #2563EB; color: #fff; border-radius: 14px; padding: 22px 24px; }
  .header h1 { margin: 0; font-size: 26px; letter-spacing: .3px; }
  .header .addr { margin-top: 6px; font-size: 13px; opacity: .92; line-height: 1.5; }
  .meta { display: flex; justify-content: space-between; margin-top: 22px; }
  .label { font-size: 11px; letter-spacing: 1.5px; color: #6b7280; font-weight: 700; }
  .pname { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .muted { color: #6b7280; font-size: 13px; }
  .invtitle { text-align: right; }
  .invtitle .big { font-size: 22px; font-weight: 800; color: #2563EB; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 14px; }
  thead th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 12px; letter-spacing: .5px; color: #374151; }
  tbody td { padding: 11px 12px; border-bottom: 1px solid #eceef1; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; }
  .totals { margin-top: 18px; margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 19px; font-weight: 800; }
  .grand .amt { color: #2563EB; }
  .pay { margin-top: 8px; }
  .pay span { display: inline-block; background: #ecfdf5; color: #059669; font-weight: 700; padding: 5px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #d1d5db; padding-top: 18px; }
  .thanks { font-size: 16px; font-weight: 700; }
  .qr { text-align: center; }
  .brand { margin-top: 26px; text-align: center; color: #9ca3af; font-size: 11px; letter-spacing: .4px; }
  .brand b { color: #2563EB; }
</style>
</head>
<body>
  <div class="header">
    <h1>${esc(storeName)}</h1>
    <div class="addr">
      ${store.address ? esc(store.address) + '<br/>' : ''}
      ${contactLine}
      ${gstNo ? (contactLine ? '<br/>' : '') + 'GSTIN: ' + esc(gstNo) : ''}
    </div>
  </div>

  <div class="meta">
    ${customerBlock || '<div></div>'}
    <div class="invtitle">
      <div class="big">INVOICE</div>
      <div class="muted">#${esc(d.invoiceNo)}</div>
      <div class="muted">${esc(d.date)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c">#</th>
        <th>Item</th>
        <th class="c">Qty</th>
        <th class="r">Rate</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="muted">Subtotal</span><span>${inr(d.subtotal)}</span></div>
    ${d.discount > 0 ? `<div class="row"><span class="muted">Discount</span><span>- ${inr(d.discount)}</span></div>` : ''}
    ${gstRows}
    <div class="row grand"><span>${showGst ? 'Total (incl. GST)' : 'Total'}</span><span class="amt">${inr(d.total)}</span></div>
    <div class="pay"><span>Paid via ${esc(d.paymentMethod)}</span></div>
  </div>

  <div class="footer">
    <div>
      <div class="thanks">Thank you for shopping! 🙏</div>
      <div class="muted">Please visit again.${store.phone ? ' Reorder: ' + esc(store.phone) : ''}</div>
    </div>
    ${qrBlock}
  </div>

  <div class="brand">Billed with <b>QuickBill Pro</b> — fast billing &amp; inventory for your store</div>
</body>
</html>`;
};
