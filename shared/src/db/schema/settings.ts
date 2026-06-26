import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Global key/value configuration (SRS NFR-MNT-01 — config separate from code). Holds settings
 * administrators can change without a deploy: retention period, organisation name, etc.
 */
export const setting = pgTable('setting', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
