import { getDB } from './index';
import { newId } from '@/utils/id';
import {
  Product,
  Sale,
  CartItem,
  PaymentMethod,
  HomeStats,
  Customer,
  CreditTransaction,
  User,
  Role,
  Shift,
  ActivityLog,
  Supplier,
  ProductBatch,
  Purchase,
} from '@/types';

const LOW_STOCK_THRESHOLD = 5;

/* -------------------------------------------------------------------------- */
/*  Activity log                                                              */
/* -------------------------------------------------------------------------- */

export const logActivity = async (
  userId: string,
  action: string,
  details = ''
): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO activity_logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)',
    [newId('log'), userId, action, details, new Date().toISOString()]
  );
};

/* -------------------------------------------------------------------------- */
/*  Users / staff (owner-managed)                                            */
/* -------------------------------------------------------------------------- */

export const getUsers = async (): Promise<User[]> => {
  const db = await getDB();
  return db.getAllAsync<User>(
    "SELECT * FROM users ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, name COLLATE NOCASE"
  );
};

export const getUserById = async (id: string): Promise<User | null> => {
  const db = await getDB();
  return db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [id]);
};

export interface SaveUserInput {
  id?: string;
  name: string;
  pin: string;
  role: Role;
  maxDiscount: number;
  canStockIn?: boolean;
  canSuppliers?: boolean;
  canEditBills?: boolean;
}

/** Creates or updates a staff account. Enforces a 4-digit, unique PIN. */
export const saveUser = async (u: SaveUserInput): Promise<string> => {
  const db = await getDB();
  if (!/^\d{4}$/.test(u.pin)) throw new Error('PIN must be exactly 4 digits.');

  const clash = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM users WHERE pin = ? AND id <> ?',
    [u.pin, u.id ?? '']
  );
  if (clash) throw new Error('That PIN is already used by another account.');

  const csi = u.canStockIn ? 1 : 0;
  const csu = u.canSuppliers ? 1 : 0;
  const ceb = u.canEditBills ? 1 : 0;
  if (u.id) {
    await db.runAsync(
      'UPDATE users SET name = ?, pin = ?, role = ?, maxDiscount = ?, canStockIn = ?, canSuppliers = ?, canEditBills = ? WHERE id = ?',
      [u.name, u.pin, u.role, u.maxDiscount, csi, csu, ceb, u.id]
    );
    return u.id;
  }
  const id = newId('user');
  await db.runAsync(
    'INSERT INTO users (id, name, pin, role, maxDiscount, canStockIn, canSuppliers, canEditBills) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, u.name, u.pin, u.role, u.maxDiscount, csi, csu, ceb]
  );
  return id;
};

/** Removes a staff account. Refuses to delete the final owner. */
export const deleteUser = async (id: string): Promise<void> => {
  const db = await getDB();
  const target = await db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) return;
  if (target.role === 'owner') {
    const owners = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'owner'"
    );
    if ((owners?.c ?? 0) <= 1) throw new Error('You cannot delete the only owner account.');
  }
  await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
};

/* -------------------------------------------------------------------------- */
/*  Products                                                                  */
/* -------------------------------------------------------------------------- */

export const getProducts = async (search = ''): Promise<Product[]> => {
  const db = await getDB();
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    return db.getAllAsync<Product>(
      'SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name COLLATE NOCASE',
      [q, q]
    );
  }
  return db.getAllAsync<Product>('SELECT * FROM products ORDER BY name COLLATE NOCASE');
};

export const getProductById = async (id: string): Promise<Product | null> => {
  const db = await getDB();
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', [id]);
};

export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  const db = await getDB();
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE barcode = ?', [barcode]);
};

/** Insert when id is empty, otherwise update. Returns the saved product id. */
export const saveProduct = async (
  p: Omit<Product, 'id'> & { id?: string }
): Promise<string> => {
  const db = await getDB();
  if (p.id) {
    await db.runAsync(
      `UPDATE products SET name = ?, barcode = ?, buyPrice = ?, sellPrice = ?,
         stock = ?, unit = ?, expiryDate = ?, category = ?, maxDiscount = ? WHERE id = ?`,
      [
        p.name,
        p.barcode ?? null,
        p.buyPrice,
        p.sellPrice,
        p.stock,
        p.unit,
        p.expiryDate ?? null,
        p.category ?? null,
        p.maxDiscount ?? null,
        p.id,
      ]
    );
    return p.id;
  }
  const id = newId('prod');
  await db.runAsync(
    `INSERT INTO products (id, name, barcode, buyPrice, sellPrice, stock, unit, expiryDate, category, maxDiscount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      p.name,
      p.barcode ?? null,
      p.buyPrice,
      p.sellPrice,
      p.stock,
      p.unit,
      p.expiryDate ?? null,
      p.category ?? null,
      p.maxDiscount ?? null,
    ]
  );
  return id;
};

export const deleteProduct = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
};

/** Distinct, non-empty category names already in use (for suggestions). */
export const getCategories = async (): Promise<string[]> => {
  const db = await getDB();
  const rows = await db.getAllAsync<{ category: string }>(
    `SELECT DISTINCT category FROM products
       WHERE category IS NOT NULL AND TRIM(category) <> ''
       ORDER BY category COLLATE NOCASE`
  );
  return rows.map((r) => r.category);
};

/** Add (positive) or remove (negative) stock for a single product. */
export const adjustStock = async (id: string, delta: number): Promise<void> => {
  const db = await getDB();
  await db.runAsync('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?', [
    delta,
    id,
  ]);
};

export const getLowStockProducts = async (): Promise<Product[]> => {
  const db = await getDB();
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC',
    [LOW_STOCK_THRESHOLD]
  );
};

/* -------------------------------------------------------------------------- */
/*  Customers                                                                 */
/* -------------------------------------------------------------------------- */

export const getCustomers = async (search = ''): Promise<Customer[]> => {
  const db = await getDB();
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    return db.getAllAsync<Customer>(
      'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name COLLATE NOCASE',
      [q, q]
    );
  }
  return db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY name COLLATE NOCASE');
};

export const getCustomerById = async (id: string): Promise<Customer | null> => {
  const db = await getDB();
  return db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
};

/** Insert (no id) or update (id present). Never overwrites currentDue. */
export const saveCustomer = async (
  c: Pick<Customer, 'name' | 'phone' | 'creditLimit' | 'discountPct'> & { id?: string }
): Promise<string> => {
  const db = await getDB();
  if (c.id) {
    await db.runAsync(
      'UPDATE customers SET name = ?, phone = ?, creditLimit = ?, discountPct = ? WHERE id = ?',
      [c.name, c.phone ?? null, c.creditLimit, c.discountPct, c.id]
    );
    return c.id;
  }
  const id = newId('cust');
  await db.runAsync(
    `INSERT INTO customers (id, name, phone, creditLimit, currentDue, discountPct)
       VALUES (?, ?, ?, ?, 0, ?)`,
    [id, c.name, c.phone ?? null, c.creditLimit, c.discountPct]
  );
  return id;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync('DELETE FROM credit_transactions WHERE customerId = ?', [id]);
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
};

export const getTotalOutstanding = async (): Promise<number> => {
  const db = await getDB();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(currentDue), 0) AS total FROM customers'
  );
  return row?.total ?? 0;
};

/** Records a repayment: lowers the due (not below 0) and logs a ledger entry. */
export const recordPayment = async (
  customerId: string,
  amount: number,
  userId: string,
  note = ''
): Promise<void> => {
  if (amount <= 0) return;
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE customers SET currentDue = MAX(0, currentDue - ?) WHERE id = ?', [
      amount,
      customerId,
    ]);
    await db.runAsync(
      `INSERT INTO credit_transactions (id, customerId, saleId, amount, type, note, userId, timestamp)
         VALUES (?, ?, NULL, ?, 'payment', ?, ?, ?)`,
      [newId('ct'), customerId, amount, note || null, userId, new Date().toISOString()]
    );
  });
  await logActivity(userId, 'PAYMENT', `Customer ${customerId} paid ${amount}`);
};

export const getCustomerTransactions = async (
  customerId: string,
  limit = 50
): Promise<CreditTransaction[]> => {
  const db = await getDB();
  return db.getAllAsync<CreditTransaction>(
    'SELECT * FROM credit_transactions WHERE customerId = ? ORDER BY timestamp DESC LIMIT ?',
    [customerId, limit]
  );
};

export const getCustomerSales = async (customerId: string): Promise<RecentSale[]> => {
  const db = await getDB();
  return db.getAllAsync<RecentSale>(
    `SELECT s.*, (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE saleId = s.id) AS itemCount
       FROM sales s WHERE s.customerId = ? ORDER BY s.date DESC`,
    [customerId]
  );
};

/* -------------------------------------------------------------------------- */
/*  Sales / checkout                                                          */
/* -------------------------------------------------------------------------- */

type DB = Awaited<ReturnType<typeof getDB>>;

/** Reduces tracked batches for a product, earliest-expiry-first. Best-effort. */
const deductBatchesFEFO = async (db: DB, productId: string, qty: number): Promise<void> => {
  let remaining = qty;
  const batches = await db.getAllAsync<{ id: string; quantityRemaining: number }>(
    `SELECT id, quantityRemaining FROM product_batches
       WHERE productId = ? AND quantityRemaining > 0
       ORDER BY (expiryDate IS NULL), expiryDate ASC, receivedAt ASC`,
    [productId]
  );
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantityRemaining, remaining);
    await db.runAsync(
      'UPDATE product_batches SET quantityRemaining = quantityRemaining - ? WHERE id = ?',
      [take, b.id]
    );
    remaining -= take;
  }
};

export interface CheckoutInput {
  items: CartItem[];
  discountAmount: number;
  paymentMethod: PaymentMethod;
  userId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  shiftId?: string | null;
}

/**
 * Persists a sale, its line items and decrements stock inside one transaction.
 * Returns the created sale id.
 */
export const checkout = async (input: CheckoutInput): Promise<string> => {
  const db = await getDB();
  const total = input.items.reduce(
    (sum, it) => sum + it.product.sellPrice * it.quantity,
    0
  );
  const discount = Math.min(Math.max(input.discountAmount, 0), total);
  const final = total - discount;
  const saleId = newId('sale');
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sales
         (id, customerId, userId, shiftId, totalAmount, discountAmount, finalAmount, paymentMethod, date, customerName, customerPhone, customerAddress)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        input.customerId ?? null,
        input.userId,
        input.shiftId ?? null,
        total,
        discount,
        final,
        input.paymentMethod,
        now,
        input.customerName?.trim() || null,
        input.customerPhone?.trim() || null,
        input.customerAddress?.trim() || null,
      ]
    );

    for (const it of input.items) {
      await db.runAsync(
        `INSERT INTO sale_items (id, saleId, productId, quantity, priceAtSale)
           VALUES (?, ?, ?, ?, ?)`,
        [newId('si'), saleId, it.product.id, it.quantity, it.product.sellPrice]
      );
      await db.runAsync('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [
        it.quantity,
        it.product.id,
      ]);
      // Best-effort: draw down tracked batches first-expiry-first (FEFO).
      await deductBatchesFEFO(db, it.product.id, it.quantity);
    }

    // On-credit sales add to the customer's outstanding due and ledger.
    if (input.paymentMethod === 'credit' && input.customerId) {
      await db.runAsync('UPDATE customers SET currentDue = currentDue + ? WHERE id = ?', [
        final,
        input.customerId,
      ]);
      await db.runAsync(
        `INSERT INTO credit_transactions (id, customerId, saleId, amount, type, note, userId, timestamp)
           VALUES (?, ?, ?, ?, 'charge', NULL, ?, ?)`,
        [newId('ct'), input.customerId, saleId, final, input.userId, now]
      );
    }
  });

  await logActivity(input.userId, 'SALE', `Sale ${saleId} for ${final}`);
  return saleId;
};

export interface RecentSale extends Sale {
  itemCount: number;
}

export const getRecentSales = async (limit = 10): Promise<RecentSale[]> => {
  const db = await getDB();
  return db.getAllAsync<RecentSale>(
    `SELECT s.*, (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE saleId = s.id) AS itemCount
       FROM sales s ORDER BY s.date DESC LIMIT ?`,
    [limit]
  );
};

/** Full sales history (most recent first). */
export const getSales = async (limit = 100): Promise<RecentSale[]> => getRecentSales(limit);

export interface SaleItemDetail {
  id: string;
  productId: string;
  name: string | null; // null if the product was deleted
  unit: string | null;
  quantity: number;
  priceAtSale: number;
  currentStock: number | null;
}

export interface SaleDetail {
  sale: Sale;
  items: SaleItemDetail[];
}

export const getSaleDetail = async (saleId: string): Promise<SaleDetail | null> => {
  const db = await getDB();
  const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) return null;
  const items = await db.getAllAsync<SaleItemDetail>(
    `SELECT si.id, si.productId, si.quantity, si.priceAtSale,
            p.name AS name, p.unit AS unit, p.stock AS currentStock
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.productId
       WHERE si.saleId = ?`,
    [saleId]
  );
  return { sale, items };
};

export interface EditedLine {
  productId: string;
  quantity: number;
  priceAtSale: number;
}

/**
 * Replaces a sale's line items (for returns / quantity changes). Stock is
 * restored from the old lines then re-deducted for the new lines, totals are
 * recomputed, and any credit balance is adjusted. Lines with quantity 0 are
 * dropped (a full return of that item).
 */
export const updateSale = async (
  saleId: string,
  lines: EditedLine[],
  userId: string
): Promise<void> => {
  const db = await getDB();
  const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) throw new Error('Sale not found');

  const kept = lines.filter((l) => l.quantity > 0);
  const newTotal = kept.reduce((s, l) => s + l.priceAtSale * l.quantity, 0);
  const newDiscount = Math.min(sale.discountAmount, newTotal);
  const newFinal = newTotal - newDiscount;

  await db.withTransactionAsync(async () => {
    // Restore stock from the existing lines, then clear them.
    const oldItems = await db.getAllAsync<{ productId: string; quantity: number }>(
      'SELECT productId, quantity FROM sale_items WHERE saleId = ?',
      [saleId]
    );
    for (const it of oldItems) {
      await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [
        it.quantity,
        it.productId,
      ]);
    }
    await db.runAsync('DELETE FROM sale_items WHERE saleId = ?', [saleId]);

    // Insert the edited lines and deduct stock again.
    for (const l of kept) {
      await db.runAsync(
        `INSERT INTO sale_items (id, saleId, productId, quantity, priceAtSale)
           VALUES (?, ?, ?, ?, ?)`,
        [newId('si'), saleId, l.productId, l.quantity, l.priceAtSale]
      );
      await db.runAsync('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [
        l.quantity,
        l.productId,
      ]);
    }

    await db.runAsync(
      'UPDATE sales SET totalAmount = ?, discountAmount = ?, finalAmount = ? WHERE id = ?',
      [newTotal, newDiscount, newFinal, saleId]
    );

    // Keep a credit customer's outstanding balance in sync with the change.
    if (sale.paymentMethod === 'credit' && sale.customerId) {
      const delta = newFinal - sale.finalAmount;
      await db.runAsync('UPDATE customers SET currentDue = currentDue + ? WHERE id = ?', [
        delta,
        sale.customerId,
      ]);
    }
  });

  await logActivity(userId, 'EDIT_SALE', `Edited sale ${saleId}: total now ${newFinal}`);
};

/** Deletes a sale entirely (full return): restores stock and clears any due. */
export const deleteSale = async (saleId: string, userId: string): Promise<void> => {
  const db = await getDB();
  const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) return;

  await db.withTransactionAsync(async () => {
    const oldItems = await db.getAllAsync<{ productId: string; quantity: number }>(
      'SELECT productId, quantity FROM sale_items WHERE saleId = ?',
      [saleId]
    );
    for (const it of oldItems) {
      await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [
        it.quantity,
        it.productId,
      ]);
    }
    await db.runAsync('DELETE FROM sale_items WHERE saleId = ?', [saleId]);

    if (sale.paymentMethod === 'credit' && sale.customerId) {
      await db.runAsync('UPDATE customers SET currentDue = currentDue - ? WHERE id = ?', [
        sale.finalAmount,
        sale.customerId,
      ]);
    }
    await db.runAsync('DELETE FROM sales WHERE id = ?', [saleId]);
  });

  await logActivity(userId, 'DELETE_SALE', `Deleted sale ${saleId} (${sale.finalAmount})`);
};

/* -------------------------------------------------------------------------- */
/*  Dashboard / reporting                                                     */
/* -------------------------------------------------------------------------- */

export const getHomeStats = async (): Promise<HomeStats> => {
  const db = await getDB();

  // Compare in local time so "today" matches the shop's clock, not UTC.
  const sales = await db.getFirstAsync<{ total: number; orders: number }>(
    `SELECT COALESCE(SUM(finalAmount), 0) AS total, COUNT(*) AS orders
       FROM sales WHERE date(date, 'localtime') = date('now', 'localtime')`
  );
  const low = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products WHERE stock <= ?',
    [LOW_STOCK_THRESHOLD]
  );
  const products = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products'
  );

  return {
    todaySales: sales?.total ?? 0,
    todayOrders: sales?.orders ?? 0,
    lowStock: low?.count ?? 0,
    totalProducts: products?.count ?? 0,
  };
};

export interface DailySales {
  day: string; // YYYY-MM-DD
  total: number;
}

/** Sales totals for the last `days` calendar days (oldest first), in local time. */
export const getSalesTrend = async (days = 7): Promise<DailySales[]> => {
  const db = await getDB();
  const rows = await db.getAllAsync<DailySales>(
    `SELECT date(date, 'localtime') AS day, COALESCE(SUM(finalAmount), 0) AS total
       FROM sales
       WHERE date(date, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY day ORDER BY day ASC`,
    [`-${days - 1} days`]
  );

  // Fill missing days with 0 so the chart has a continuous axis.
  const map = new Map(rows.map((r) => [r.day, r.total]));
  const out: DailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    out.push({ day: key, total: map.get(key) ?? 0 });
  }
  return out;
};

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export const getTopProducts = async (limit = 5): Promise<TopProduct[]> => {
  const db = await getDB();
  return db.getAllAsync<TopProduct>(
    `SELECT p.name AS name,
            SUM(si.quantity) AS qty,
            SUM(si.quantity * si.priceAtSale) AS revenue
       FROM sale_items si
       JOIN products p ON p.id = si.productId
       GROUP BY si.productId ORDER BY qty DESC LIMIT ?`,
    [limit]
  );
};

export interface SalesSummary {
  total: number;
  orders: number;
  itemsSold: number;
}

export const getSummary = async (sinceDays: number): Promise<SalesSummary> => {
  const db = await getDB();
  const sales = await db.getFirstAsync<{ total: number; orders: number }>(
    `SELECT COALESCE(SUM(finalAmount), 0) AS total, COUNT(*) AS orders
       FROM sales WHERE date >= date('now', ?)`,
    [`-${sinceDays - 1} days`]
  );
  const items = await db.getFirstAsync<{ qty: number }>(
    `SELECT COALESCE(SUM(si.quantity), 0) AS qty
       FROM sale_items si JOIN sales s ON s.id = si.saleId
       WHERE s.date >= date('now', ?)`,
    [`-${sinceDays - 1} days`]
  );
  return {
    total: sales?.total ?? 0,
    orders: sales?.orders ?? 0,
    itemsSold: items?.qty ?? 0,
  };
};

/* -------------------------------------------------------------------------- */
/*  Owner analytics: P&L, charts, dead stock                                  */
/* -------------------------------------------------------------------------- */

export interface ProfitSummary {
  revenue: number; // net of discounts
  cogs: number; // cost of goods sold (buy price x qty)
  profit: number;
  marginPct: number;
  orders: number;
  itemsSold: number;
}

/** Profit & Loss for the last `days` days. COGS uses each product's buy price. */
export const getProfitSummary = async (days: number): Promise<ProfitSummary> => {
  const db = await getDB();
  const since = `-${days - 1} days`;

  const rev = await db.getFirstAsync<{ revenue: number; orders: number }>(
    `SELECT COALESCE(SUM(finalAmount), 0) AS revenue, COUNT(*) AS orders
       FROM sales WHERE date(date, 'localtime') >= date('now', 'localtime', ?)`,
    [since]
  );
  const cost = await db.getFirstAsync<{ cogs: number; items: number }>(
    `SELECT COALESCE(SUM(si.quantity * p.buyPrice), 0) AS cogs,
            COALESCE(SUM(si.quantity), 0) AS items
       FROM sale_items si
       JOIN sales s ON s.id = si.saleId
       JOIN products p ON p.id = si.productId
       WHERE date(s.date, 'localtime') >= date('now', 'localtime', ?)`,
    [since]
  );

  const revenue = rev?.revenue ?? 0;
  const cogs = cost?.cogs ?? 0;
  const profit = revenue - cogs;
  return {
    revenue,
    cogs,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    orders: rev?.orders ?? 0,
    itemsSold: cost?.items ?? 0,
  };
};

export interface HourlySales {
  hour: number; // 0..23 (local)
  total: number;
}

/** Revenue grouped by hour-of-day (local time) over the last `days` days. */
export const getSalesByHour = async (days: number): Promise<HourlySales[]> => {
  const db = await getDB();
  const rows = await db.getAllAsync<{ hour: string; total: number }>(
    `SELECT strftime('%H', date, 'localtime') AS hour,
            COALESCE(SUM(finalAmount), 0) AS total
       FROM sales
       WHERE date(date, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY hour ORDER BY hour`,
    [`-${days - 1} days`]
  );
  const map = new Map(rows.map((r) => [parseInt(r.hour, 10), r.total]));
  // Only return hours a shop is realistically open to keep the chart readable.
  const out: HourlySales[] = [];
  for (let h = 6; h <= 23; h++) out.push({ hour: h, total: map.get(h) ?? 0 });
  return out;
};

/** Best-selling products by revenue over the last `days` days. */
export const getBestSellers = async (days: number, limit = 5): Promise<TopProduct[]> => {
  const db = await getDB();
  return db.getAllAsync<TopProduct>(
    `SELECT p.name AS name,
            SUM(si.quantity) AS qty,
            SUM(si.quantity * si.priceAtSale) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.saleId
       JOIN products p ON p.id = si.productId
       WHERE date(s.date, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY si.productId ORDER BY revenue DESC LIMIT ?`,
    [`-${days - 1} days`, limit]
  );
};

export interface TopCustomer {
  name: string;
  total: number;
  orders: number;
}

/** Highest-spending customers over the last `days` days (named sales only). */
export const getTopCustomers = async (days: number, limit = 5): Promise<TopCustomer[]> => {
  const db = await getDB();
  return db.getAllAsync<TopCustomer>(
    `SELECT c.name AS name,
            COALESCE(SUM(s.finalAmount), 0) AS total,
            COUNT(*) AS orders
       FROM sales s
       JOIN customers c ON c.id = s.customerId
       WHERE s.customerId IS NOT NULL
         AND date(s.date, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY s.customerId ORDER BY total DESC LIMIT ?`,
    [`-${days - 1} days`, limit]
  );
};

/** In-stock products with no sales in the last `days` days (dead stock). */
export const getDeadStock = async (days: number): Promise<Product[]> => {
  const db = await getDB();
  return db.getAllAsync<Product>(
    `SELECT * FROM products
       WHERE stock > 0
         AND id NOT IN (
           SELECT si.productId FROM sale_items si
           JOIN sales s ON s.id = si.saleId
           WHERE date(s.date, 'localtime') >= date('now', 'localtime', ?)
         )
       ORDER BY (buyPrice * stock) DESC`,
    [`-${days - 1} days`]
  );
};

/* -------------------------------------------------------------------------- */
/*  Shifts (Z-report) & activity log                                          */
/* -------------------------------------------------------------------------- */

export const getOpenShift = async (userId: string): Promise<Shift | null> => {
  const db = await getDB();
  return db.getFirstAsync<Shift>(
    "SELECT * FROM shifts WHERE userId = ? AND status = 'open' ORDER BY startTime DESC LIMIT 1",
    [userId]
  );
};

export const openShift = async (userId: string, openingBalance: number): Promise<string> => {
  const db = await getDB();
  const existing = await getOpenShift(userId);
  if (existing) return existing.id; // already open
  const id = newId('shift');
  await db.runAsync(
    "INSERT INTO shifts (id, userId, startTime, openingBalance, status) VALUES (?, ?, ?, ?, 'open')",
    [id, userId, new Date().toISOString(), openingBalance]
  );
  await logActivity(userId, 'SHIFT_OPEN', `Opened shift (float ${openingBalance})`);
  return id;
};

export const closeShift = async (
  shiftId: string,
  closingBalance: number,
  userId: string
): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    "UPDATE shifts SET endTime = ?, closingBalance = ?, status = 'closed' WHERE id = ?",
    [new Date().toISOString(), closingBalance, shiftId]
  );
  await logActivity(userId, 'SHIFT_CLOSE', `Closed shift (counted ${closingBalance})`);
};

export interface ShiftRow extends Shift {
  userName: string | null;
}

export const getShifts = async (limit = 30): Promise<ShiftRow[]> => {
  const db = await getDB();
  return db.getAllAsync<ShiftRow>(
    `SELECT sh.*, u.name AS userName FROM shifts sh
       LEFT JOIN users u ON u.id = sh.userId
       ORDER BY sh.startTime DESC LIMIT ?`,
    [limit]
  );
};

export interface ShiftReport {
  shift: ShiftRow;
  totals: { total: number; orders: number; itemsSold: number };
  byMethod: Record<PaymentMethod, number>;
  cashSales: number;
  expectedCash: number; // opening float + cash sales
  variance: number | null; // counted - expected (null while open)
}

export const getShiftReport = async (shiftId: string): Promise<ShiftReport | null> => {
  const db = await getDB();
  const shift = await db.getFirstAsync<ShiftRow>(
    'SELECT sh.*, u.name AS userName FROM shifts sh LEFT JOIN users u ON u.id = sh.userId WHERE sh.id = ?',
    [shiftId]
  );
  if (!shift) return null;

  const totalsRow = await db.getFirstAsync<{ total: number; orders: number }>(
    'SELECT COALESCE(SUM(finalAmount), 0) AS total, COUNT(*) AS orders FROM sales WHERE shiftId = ?',
    [shiftId]
  );
  const itemsRow = await db.getFirstAsync<{ qty: number }>(
    `SELECT COALESCE(SUM(si.quantity), 0) AS qty FROM sale_items si
       JOIN sales s ON s.id = si.saleId WHERE s.shiftId = ?`,
    [shiftId]
  );
  const methodRows = await db.getAllAsync<{ paymentMethod: PaymentMethod; total: number }>(
    'SELECT paymentMethod, COALESCE(SUM(finalAmount), 0) AS total FROM sales WHERE shiftId = ? GROUP BY paymentMethod',
    [shiftId]
  );

  const byMethod: Record<PaymentMethod, number> = { cash: 0, upi: 0, card: 0, credit: 0 };
  for (const r of methodRows) byMethod[r.paymentMethod] = r.total;

  const cashSales = byMethod.cash;
  const expectedCash = shift.openingBalance + cashSales;
  const variance =
    shift.status === 'closed' && shift.closingBalance != null
      ? shift.closingBalance - expectedCash
      : null;

  return {
    shift,
    totals: { total: totalsRow?.total ?? 0, orders: totalsRow?.orders ?? 0, itemsSold: itemsRow?.qty ?? 0 },
    byMethod,
    cashSales,
    expectedCash,
    variance,
  };
};

export interface ActivityRow extends ActivityLog {
  userName: string | null;
}

export const getActivityLogs = async (limit = 100): Promise<ActivityRow[]> => {
  const db = await getDB();
  return db.getAllAsync<ActivityRow>(
    `SELECT a.*, u.name AS userName FROM activity_logs a
       LEFT JOIN users u ON u.id = a.userId
       ORDER BY a.timestamp DESC LIMIT ?`,
    [limit]
  );
};

/* -------------------------------------------------------------------------- */
/*  Suppliers, purchases (stock-in) & batches                                 */
/* -------------------------------------------------------------------------- */

export const getSuppliers = async (search = ''): Promise<Supplier[]> => {
  const db = await getDB();
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    return db.getAllAsync<Supplier>(
      'SELECT * FROM suppliers WHERE name LIKE ? OR phone LIKE ? ORDER BY name COLLATE NOCASE',
      [q, q]
    );
  }
  return db.getAllAsync<Supplier>('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE');
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
  const db = await getDB();
  return db.getFirstAsync<Supplier>('SELECT * FROM suppliers WHERE id = ?', [id]);
};

export const saveSupplier = async (
  s: Pick<Supplier, 'name' | 'phone' | 'contactPerson' | 'address' | 'notes'> & { id?: string }
): Promise<string> => {
  const db = await getDB();
  if (s.id) {
    await db.runAsync(
      'UPDATE suppliers SET name = ?, phone = ?, contactPerson = ?, address = ?, notes = ? WHERE id = ?',
      [s.name, s.phone ?? null, s.contactPerson ?? null, s.address ?? null, s.notes ?? null, s.id]
    );
    return s.id;
  }
  const id = newId('sup');
  await db.runAsync(
    `INSERT INTO suppliers (id, name, phone, contactPerson, address, notes, currentPayable, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, s.name, s.phone ?? null, s.contactPerson ?? null, s.address ?? null, s.notes ?? null, new Date().toISOString()]
  );
  return id;
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync('DELETE FROM suppliers WHERE id = ?', [id]);
};

export const getTotalPayable = async (): Promise<number> => {
  const db = await getDB();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(currentPayable), 0) AS total FROM suppliers'
  );
  return row?.total ?? 0;
};

export const recordSupplierPayment = async (
  supplierId: string,
  amount: number,
  userId: string
): Promise<void> => {
  if (amount <= 0) return;
  const db = await getDB();
  await db.runAsync('UPDATE suppliers SET currentPayable = MAX(0, currentPayable - ?) WHERE id = ?', [
    amount,
    supplierId,
  ]);
  await logActivity(userId, 'SUPPLIER_PAYMENT', `Paid supplier ${supplierId} ${amount}`);
};

export interface PurchaseLine {
  productId: string;
  quantity: number;
  buyPrice: number;
  batchNo?: string | null;
  expiryDate?: string | null;
}

export interface CreatePurchaseInput {
  supplierId: string | null;
  userId: string;
  paid: boolean;
  note?: string;
  /** YYYY-MM-DD the stock was received; defaults to today. */
  purchaseDate?: string | null;
  lines: PurchaseLine[];
}

/**
 * Records a stock-in: raises stock, refreshes each product's buy price (and
 * expiry), writes batch rows, and adds to the supplier's payable when unpaid.
 */
export const createPurchase = async (input: CreatePurchaseInput): Promise<string> => {
  const db = await getDB();
  const lines = input.lines.filter((l) => l.quantity > 0);
  const total = lines.reduce((s, l) => s + l.buyPrice * l.quantity, 0);
  const purchaseId = newId('pur');
  const now = new Date().toISOString();
  // Owner may record stock-in for an earlier day; default to now. Noon avoids
  // any date shift when the stored UTC time is read back in local time.
  const when =
    input.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate)
      ? new Date(input.purchaseDate + 'T12:00:00').toISOString()
      : now;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO purchases (id, supplierId, userId, date, totalAmount, paid, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [purchaseId, input.supplierId ?? null, input.userId, when, total, input.paid ? 1 : 0, input.note ?? null]
    );

    for (const l of lines) {
      await db.runAsync(
        `INSERT INTO purchase_items (id, purchaseId, productId, quantity, buyPrice, batchNo, expiryDate)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId('pi'), purchaseId, l.productId, l.quantity, l.buyPrice, l.batchNo ?? null, l.expiryDate ?? null]
      );
      await db.runAsync('UPDATE products SET stock = stock + ?, buyPrice = ? WHERE id = ?', [
        l.quantity,
        l.buyPrice,
        l.productId,
      ]);
      if (l.expiryDate) {
        await db.runAsync('UPDATE products SET expiryDate = ? WHERE id = ?', [l.expiryDate, l.productId]);
      }
      await db.runAsync(
        `INSERT INTO product_batches
           (id, productId, purchaseId, supplierId, batchNo, expiryDate, quantityRemaining, buyPrice, receivedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId('batch'),
          l.productId,
          purchaseId,
          input.supplierId ?? null,
          l.batchNo ?? null,
          l.expiryDate ?? null,
          l.quantity,
          l.buyPrice,
          when,
        ]
      );
    }

    if (!input.paid && input.supplierId) {
      await db.runAsync('UPDATE suppliers SET currentPayable = currentPayable + ? WHERE id = ?', [
        total,
        input.supplierId,
      ]);
    }
  });

  await logActivity(input.userId, 'PURCHASE', `Stock-in ${purchaseId} for ${total}`);
  return purchaseId;
};

export interface PurchaseRow extends Purchase {
  itemCount: number;
  supplierName: string | null;
}

export const getPurchasesBySupplier = async (supplierId: string): Promise<PurchaseRow[]> => {
  const db = await getDB();
  return db.getAllAsync<PurchaseRow>(
    `SELECT p.*, s.name AS supplierName,
            (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items WHERE purchaseId = p.id) AS itemCount
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplierId
       WHERE p.supplierId = ? ORDER BY p.date DESC`,
    [supplierId]
  );
};

export const getRecentPurchases = async (limit = 50): Promise<PurchaseRow[]> => {
  const db = await getDB();
  return db.getAllAsync<PurchaseRow>(
    `SELECT p.*, s.name AS supplierName,
            (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items WHERE purchaseId = p.id) AS itemCount
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplierId
       ORDER BY p.date DESC LIMIT ?`,
    [limit]
  );
};

export const getBatchesByProduct = async (productId: string): Promise<ProductBatch[]> => {
  const db = await getDB();
  return db.getAllAsync<ProductBatch>(
    `SELECT * FROM product_batches WHERE productId = ? AND quantityRemaining > 0
       ORDER BY (expiryDate IS NULL), expiryDate ASC`,
    [productId]
  );
};

export interface ExpiringBatch extends ProductBatch {
  productName: string | null;
  unit: string | null;
}

/** In-stock batches expiring within `days` days (includes already expired). */
export const getExpiringBatches = async (days = 30): Promise<ExpiringBatch[]> => {
  const db = await getDB();
  return db.getAllAsync<ExpiringBatch>(
    `SELECT b.*, p.name AS productName, p.unit AS unit
       FROM product_batches b JOIN products p ON p.id = b.productId
       WHERE b.quantityRemaining > 0
         AND b.expiryDate IS NOT NULL
         AND date(b.expiryDate) <= date('now', 'localtime', ?)
       ORDER BY b.expiryDate ASC`,
    [`+${days} days`]
  );
};
