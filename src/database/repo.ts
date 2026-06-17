import { getDB } from './index';
import { newId } from '@/utils/id';
import { todayKey } from '@/utils/format';
import {
  Product,
  Sale,
  CartItem,
  PaymentMethod,
  HomeStats,
  Customer,
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
         stock = ?, unit = ?, expiryDate = ?, category = ? WHERE id = ?`,
      [
        p.name,
        p.barcode ?? null,
        p.buyPrice,
        p.sellPrice,
        p.stock,
        p.unit,
        p.expiryDate ?? null,
        p.category ?? null,
        p.id,
      ]
    );
    return p.id;
  }
  const id = newId('prod');
  await db.runAsync(
    `INSERT INTO products (id, name, barcode, buyPrice, sellPrice, stock, unit, expiryDate, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export const getCustomers = async (): Promise<Customer[]> => {
  const db = await getDB();
  return db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY name COLLATE NOCASE');
};

/* -------------------------------------------------------------------------- */
/*  Sales / checkout                                                          */
/* -------------------------------------------------------------------------- */

export interface CheckoutInput {
  items: CartItem[];
  discountAmount: number;
  paymentMethod: PaymentMethod;
  userId: string;
  customerId?: string | null;
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
      `INSERT INTO sales (id, customerId, userId, shiftId, totalAmount, discountAmount, finalAmount, paymentMethod, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        input.customerId ?? null,
        input.userId,
        null,
        total,
        discount,
        final,
        input.paymentMethod,
        now,
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
    }

    // On-credit sales add to the customer's outstanding due.
    if (input.paymentMethod === 'credit' && input.customerId) {
      await db.runAsync('UPDATE customers SET currentDue = currentDue + ? WHERE id = ?', [
        final,
        input.customerId,
      ]);
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

/* -------------------------------------------------------------------------- */
/*  Dashboard / reporting                                                     */
/* -------------------------------------------------------------------------- */

export const getHomeStats = async (): Promise<HomeStats> => {
  const db = await getDB();
  const day = `${todayKey()}%`;

  const sales = await db.getFirstAsync<{ total: number; orders: number }>(
    `SELECT COALESCE(SUM(finalAmount), 0) AS total, COUNT(*) AS orders
       FROM sales WHERE date LIKE ?`,
    [day]
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

/** Sales totals for the last `days` calendar days (oldest first). */
export const getSalesTrend = async (days = 7): Promise<DailySales[]> => {
  const db = await getDB();
  const rows = await db.getAllAsync<DailySales>(
    `SELECT substr(date, 1, 10) AS day, COALESCE(SUM(finalAmount), 0) AS total
       FROM sales
       WHERE date >= date('now', ?)
       GROUP BY day ORDER BY day ASC`,
    [`-${days - 1} days`]
  );

  // Fill missing days with 0 so the chart has a continuous axis.
  const map = new Map(rows.map((r) => [r.day, r.total]));
  const out: DailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
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
