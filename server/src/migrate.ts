/**
 * Standalone migration runner for production / container start-up.
 *
 * Applies every pending SQL file in the `drizzle/` folder using the drizzle-orm
 * node-postgres migrator. Idempotent: already-applied migrations are tracked in the
 * `__drizzle_migrations` table, so re-running is a no-op. This avoids shipping the full
 * drizzle-kit toolchain into the runtime image — only the generated SQL is needed.
 *
 * Run after build with:  node server/dist/migrate.js
 * The migrations folder defaults to ./drizzle (relative to CWD); override with
 * DRIZZLE_MIGRATIONS_DIR for a different layout.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { env } from './env.ts';
import { logger } from './logger.ts';

const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_DIR ?? './drizzle';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool);

logger.info(`applying database migrations from ${migrationsFolder}`);
try {
  await migrate(db, { migrationsFolder });
  logger.info('✅ database migrations up to date');
} catch (err) {
  logger.error({ err }, '❌ database migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
