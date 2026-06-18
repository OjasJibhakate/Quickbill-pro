import { getDB } from './index';

type DB = Awaited<ReturnType<typeof getDB>>;

/** Append-only tables: merged by union (INSERT OR IGNORE on id). */
const APPEND_TABLES = [
  'shifts',
  'sales',
  'sale_items',
  'credit_transactions',
  'purchases',
  'purchase_items',
  'product_batches',
  'activity_logs',
  'stock_events',
  'supplier_payments',
  'tombstones',
] as const;

/** Definition tables: merged last-write-wins on updatedAt. */
const DEFINITION_TABLES = ['users', 'products', 'customers', 'suppliers'] as const;

/** Tables a tombstone is allowed to delete from (guards the dynamic DELETE). */
const TOMBSTONE_TABLES = new Set(['users', 'products', 'customers', 'suppliers', 'sales']);

/** Every table that holds shop data (used by export + full restore). */
const SYNC_TABLES = [...DEFINITION_TABLES, ...APPEND_TABLES] as const;

export interface Snapshot {
  app: 'quickbill-pro';
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Reads the whole database into a portable JSON snapshot. */
export const exportSnapshot = async (): Promise<Snapshot> => {
  const db = await getDB();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of SYNC_TABLES) {
    tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  }
  return {
    app: 'quickbill-pro',
    version: 2,
    exportedAt: new Date().toISOString(),
    tables,
  };
};

export const snapshotToJson = async (): Promise<string> =>
  JSON.stringify(await exportSnapshot());

export interface RestoreSummary {
  tables: number;
  rows: number;
}

const parseSnapshot = (json: string): Snapshot => {
  const snap = JSON.parse(json) as Snapshot;
  if (snap?.app !== 'quickbill-pro' || !snap.tables) {
    throw new Error('This file is not a QuickBill Pro backup.');
  }
  return snap;
};

const insertRow = async (db: DB, table: string, row: Record<string, unknown>, verb: string) => {
  const cols = Object.keys(row);
  if (cols.length === 0) return;
  const placeholders = cols.map(() => '?').join(', ');
  await db.runAsync(
    `${verb} INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    cols.map((c) => row[c] as any)
  );
};

/**
 * Full restore: replaces all local data with the snapshot (last-write-wins).
 * Used for the manual "restore from a file" flow.
 */
export const importSnapshot = async (json: string): Promise<RestoreSummary> => {
  const snap = parseSnapshot(json);
  const db = await getDB();
  let rows = 0;

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of SYNC_TABLES) {
        await db.runAsync(`DELETE FROM ${t}`);
        for (const row of snap.tables[t] ?? []) {
          await insertRow(db, t, row, 'INSERT');
          rows++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return { tables: SYNC_TABLES.length, rows };
};

/** Recomputes cached accumulators from the merged immutable events. */
const recomputeAccumulators = async (db: DB): Promise<void> => {
  // Stock = sum of the ledger.
  await db.runAsync(
    `UPDATE products SET stock = COALESCE(
       (SELECT SUM(delta) FROM stock_events WHERE stock_events.productId = products.id), 0)`
  );
  // Customer due = charges + adjustments − payments (never below 0).
  await db.runAsync(
    `UPDATE customers SET currentDue = MAX(0, COALESCE((
       SELECT SUM(CASE WHEN type = 'payment' THEN -amount ELSE amount END)
       FROM credit_transactions WHERE credit_transactions.customerId = customers.id), 0))`
  );
  // Supplier payable = unpaid purchase totals − supplier payments (never below 0).
  await db.runAsync(
    `UPDATE suppliers SET currentPayable = MAX(0,
       COALESCE((SELECT SUM(totalAmount) FROM purchases
                 WHERE purchases.supplierId = suppliers.id AND paid = 0), 0)
       - COALESCE((SELECT SUM(amount) FROM supplier_payments
                   WHERE supplier_payments.supplierId = suppliers.id), 0))`
  );
};

/**
 * MERGES a snapshot into local data without losing either side:
 *  - append-only tables are unioned by id,
 *  - definition tables take the newer row by updatedAt,
 *  - tombstones delete rows that were removed on any device,
 *  - accumulators (stock, dues, payables) are recomputed from the events.
 * Used for Google Drive live sync.
 */
export const mergeSnapshot = async (json: string): Promise<RestoreSummary> => {
  const snap = parseSnapshot(json);
  const db = await getDB();
  let rows = 0;

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      // 1. Union append-only tables.
      for (const t of APPEND_TABLES) {
        for (const row of snap.tables[t] ?? []) {
          await insertRow(db, t, row, 'INSERT OR IGNORE');
          rows++;
        }
      }

      // 2. Last-write-wins for definition tables.
      for (const t of DEFINITION_TABLES) {
        for (const row of snap.tables[t] ?? []) {
          const id = row.id as string | undefined;
          if (!id) continue;
          const existing = await db.getFirstAsync<{ updatedAt: string | null }>(
            `SELECT updatedAt FROM ${t} WHERE id = ?`,
            [id]
          );
          if (!existing) {
            await insertRow(db, t, row, 'INSERT');
            rows++;
          } else if (((row.updatedAt as string) ?? '') > (existing.updatedAt ?? '')) {
            await insertRow(db, t, row, 'INSERT OR REPLACE');
            rows++;
          }
        }
      }

      // 3. Apply every tombstone (delete removed rows).
      const tombs = await db.getAllAsync<{ tableName: string; entityId: string }>(
        'SELECT tableName, entityId FROM tombstones'
      );
      for (const tomb of tombs) {
        if (!TOMBSTONE_TABLES.has(tomb.tableName)) continue;
        await db.runAsync(`DELETE FROM ${tomb.tableName} WHERE id = ?`, [tomb.entityId]);
        if (tomb.tableName === 'sales') {
          await db.runAsync('DELETE FROM sale_items WHERE saleId = ?', [tomb.entityId]);
        }
      }

      // Seed an initial ledger entry for any product without events (e.g.
      // merged from an older snapshot) so recompute keeps its stock.
      const noEvents = await db.getAllAsync<{ id: string; stock: number }>(
        'SELECT id, stock FROM products WHERE id NOT IN (SELECT productId FROM stock_events)'
      );
      const seedTs = new Date().toISOString();
      for (const p of noEvents) {
        await db.runAsync(
          'INSERT OR IGNORE INTO stock_events (id, productId, delta, reason, createdAt) VALUES (?, ?, ?, ?, ?)',
          [`evt-init-${p.id}`, p.id, p.stock, 'initial', seedTs]
        );
      }

      // 4. Rebuild accumulators from the merged events.
      await recomputeAccumulators(db);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return { tables: SYNC_TABLES.length, rows };
};
