import { getDB } from './index';

/** Every table that holds shop data, child tables after their parents. */
const SYNC_TABLES = [
  'users',
  'products',
  'customers',
  'suppliers',
  'shifts',
  'sales',
  'sale_items',
  'credit_transactions',
  'purchases',
  'purchase_items',
  'product_batches',
  'activity_logs',
] as const;

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
    version: 1,
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

/**
 * Replaces all local data with the snapshot (full restore, last-write-wins).
 * Foreign keys are turned off during the swap so table order doesn't matter.
 */
export const importSnapshot = async (json: string): Promise<RestoreSummary> => {
  const snap = JSON.parse(json) as Snapshot;
  if (snap?.app !== 'quickbill-pro' || !snap.tables) {
    throw new Error('This file is not a QuickBill Pro backup.');
  }

  const db = await getDB();
  let rows = 0;

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of SYNC_TABLES) {
        await db.runAsync(`DELETE FROM ${t}`);
        const data = snap.tables[t] ?? [];
        for (const row of data) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map((c) => row[c] as any);
          await db.runAsync(
            `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
            values
          );
          rows++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  return { tables: SYNC_TABLES.length, rows };
};
