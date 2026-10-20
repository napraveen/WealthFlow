import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Database file path configurable via environment variable with fallback
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../../database.db');
const sqlite = new Database(dbPath);

// Enable foreign key constraints in SQLite
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export const rawConnection = sqlite;
