import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { schema } from '@vms/shared';
import { env } from './env.ts';
import { isServerless } from './runtime.ts';

const { Pool } = pg;

/**
 * On serverless (Vercel), each warm function instance runs `DATABASE_URL` against Neon's *pooled*
 * (`-pooler`) endpoint, which fronts Postgres with PgBouncer — so node-postgres works unchanged, but
 * the per-instance pool must stay tiny (a cold start on every path would otherwise fan out and
 * exhaust Neon's connection ceiling). On-prem keeps the normal pool.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: isServerless ? 1 : 10,
});

/** Drizzle client. `casing: 'snake_case'` matches the column names drizzle-kit generates. */
export const db = drizzle(pool, { schema, casing: 'snake_case' });

export type Database = typeof db;
