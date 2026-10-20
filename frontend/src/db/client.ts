import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// Open the device SQLite database synchronously
export const expoDb = openDatabaseSync('wealthflow.db');

// Initialize Drizzle ORM on top of SQLite database connection
export const db = drizzle(expoDb, { schema });
