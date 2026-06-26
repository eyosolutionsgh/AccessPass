import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { schema } from '@vms/shared';
import { env } from './env.ts';

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL });

/** Drizzle client. `casing: 'snake_case'` matches the column names drizzle-kit generates. */
export const db = drizzle(pool, { schema, casing: 'snake_case' });

export type Database = typeof db;
