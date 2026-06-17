import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'quickbill.db';

/**
 * Opens the database, creates tables if they don't exist, adds helpful
 * indexes and seeds the two default accounts. Safe to call multiple times.
 */
export const initializeDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL,
      maxDiscount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      buyPrice REAL NOT NULL DEFAULT 0,
      sellPrice REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      expiryDate TEXT,
      category TEXT,
      maxDiscount REAL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      creditLimit REAL DEFAULT 0,
      currentDue REAL DEFAULT 0,
      discountPct REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      saleId TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      note TEXT,
      userId TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(customerId) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      openingBalance REAL DEFAULT 0,
      closingBalance REAL,
      status TEXT DEFAULT 'open',
      FOREIGN KEY(userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      userId TEXT NOT NULL,
      shiftId TEXT,
      totalAmount REAL NOT NULL,
      discountAmount REAL DEFAULT 0,
      finalAmount REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      date TEXT NOT NULL,
      customerName TEXT,
      customerPhone TEXT,
      customerAddress TEXT,
      FOREIGN KEY(customerId) REFERENCES customers(id),
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(shiftId) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      priceAtSale REAL NOT NULL,
      FOREIGN KEY(saleId) REFERENCES sales(id),
      FOREIGN KEY(productId) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(saleId);

    -- Default Owner Account (PIN: 1234)
    INSERT OR IGNORE INTO users (id, name, pin, role, maxDiscount)
      VALUES ('owner-1', 'Store Owner', '1234', 'owner', 100);

    -- Default Employee Account (PIN: 0000)
    INSERT OR IGNORE INTO users (id, name, pin, role, maxDiscount)
      VALUES ('emp-1', 'Cashier', '0000', 'employee', 10);
  `);

  await runMigrations(db);
  return db;
};

/**
 * Adds columns introduced after the first release to databases that already
 * exist on a device. CREATE TABLE IF NOT EXISTS won't alter an existing table,
 * so we add missing columns here. Safe to run on every launch.
 */
const runMigrations = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const addColumnIfMissing = async (table: string, column: string, type: string) => {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  };

  // Optional walk-in customer details captured at billing time.
  await addColumnIfMissing('sales', 'customerName', 'TEXT');
  await addColumnIfMissing('sales', 'customerPhone', 'TEXT');
  await addColumnIfMissing('sales', 'customerAddress', 'TEXT');

  // Customer-specific default discount (Phase A).
  await addColumnIfMissing('customers', 'discountPct', 'REAL DEFAULT 0');

  // Per-product max employee discount override (null = use employee default).
  await addColumnIfMissing('products', 'maxDiscount', 'REAL');
};
