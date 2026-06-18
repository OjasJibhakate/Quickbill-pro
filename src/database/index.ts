import * as SQLite from 'expo-sqlite';
import { initializeDatabase, DB_NAME } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let onWrite: (() => void) | null = null;

/**
 * Registers a callback fired after every DB write. Used by auto-sync to
 * schedule a debounced background backup whenever data changes.
 */
export const setOnWrite = (cb: (() => void) | null): void => {
  onWrite = cb;
};

/**
 * Returns a singleton database handle. The first call initializes the schema;
 * concurrent callers share the same in-flight promise so init runs once. The
 * handle's runAsync is wrapped so every write notifies the onWrite callback.
 */
export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initializeDatabase().then((db) => {
      const origRun = db.runAsync.bind(db);
      (db as any).runAsync = (...args: unknown[]) => {
        const result = (origRun as (...a: unknown[]) => Promise<unknown>)(...args);
        Promise.resolve(result)
          .then(() => onWrite?.())
          .catch(() => {});
        return result;
      };
      dbInstance = db;
      return db;
    });
  }
  return initPromise;
};

export { DB_NAME };
