import * as SQLite from 'expo-sqlite';
import { initializeDatabase, DB_NAME } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Returns a singleton database handle. The first call initializes the schema;
 * concurrent callers share the same in-flight promise so init runs once.
 */
export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initializeDatabase().then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return initPromise;
};

export { DB_NAME };
