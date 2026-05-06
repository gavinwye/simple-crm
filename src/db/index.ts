import 'server-only';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import type { SQL } from 'drizzle-orm';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL environment variable is required');

const client = neon(url);
export const db = drizzle(client, { schema });
export { schema };

/**
 * Execute a raw SQL query and return typed rows. Postgres replacement for
 * the SQLite driver's `db.all<T>(...)` shorthand.
 */
export async function dbAll<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}
