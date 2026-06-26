import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Common columns reused across domain tables.
 * `id` is a server-generated UUID; timestamps are timezone-aware (SRS §9.4 requires
 * tz-aware storage, facility-local display happens in the UI layer).
 */
export const id = uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};
