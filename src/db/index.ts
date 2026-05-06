import 'server-only';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.DATABASE_URL ?? 'data/dev.db';

// Ensure the data directory exists.
const dir = path.dirname(dbPath);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
