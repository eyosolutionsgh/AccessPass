/**
 * Check-in/out events, badges/temporary credentials, and time-bound access permissions.
 * SRS §6.5 (check-in), §6.6 (badge/credential), §6.7 (access), §6.9 (check-out), §9.1.
 */
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { user } from './auth.ts';
import { accessPermissionStatus, checkEventMethod, credentialStatus, tagKind } from './enums.ts';
import { accessZone } from './locations.ts';
import { visit } from './visits.ts';

/** SRS §9.1 CheckInRecord — one row per check-in (and its eventual check-out). */
export const checkInRecord = pgTable('check_in_record', {
  id,
  visitId: uuid()
    .notNull()
    .references(() => visit.id, { onDelete: 'cascade' }),
  timeIn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  timeOut: timestamp({ withTimezone: true }),
  checkInMethod: checkEventMethod().notNull(),
  checkOutMethod: checkEventMethod(),
  checkInLocation: text(),
  checkOutLocation: text(),
  /** Kiosk/device identifier (SRS FR-048). */
  deviceId: text(),
  /** Staff user who processed it, or null for self-service. */
  processedBy: text().references(() => user.id, { onDelete: 'set null' }),
  selfService: boolean().notNull().default(false),
  identityVerified: boolean().notNull().default(false),
  ...timestamps,
});

/** SRS §9.1 Badge/Credential — disabled after check-out, expiry, denial, or revocation. */
export const credential = pgTable('credential', {
  id,
  visitId: uuid()
    .notNull()
    .references(() => visit.id, { onDelete: 'cascade' }),
  badgeNumber: text().notNull(),
  /** Hash of the badge QR token used for check-out / access (SRS FR-052). */
  qrBadgeTokenHash: text(),
  /** External access-card id when integrated with physical access control (SRS FR-064). */
  accessCardId: text(),
  status: credentialStatus().notNull().default('issued'),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }),
  disabledAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/**
 * Reusable physical visitor tag (numbered card or NFC) — issued at check-in and returned at
 * check-out. `returnedAt IS NULL` = still out (drives the "tags out" reconciliation report).
 */
export const visitTag = pgTable(
  'visit_tag',
  {
    id,
    visitId: uuid()
      .notNull()
      .references(() => visit.id, { onDelete: 'cascade' }),
    /** The physical tag's identifier — a printed number or an NFC card UID. */
    tagId: text().notNull(),
    kind: tagKind().notNull().default('number'),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    issuedDeviceId: text(),
    returnedAt: timestamp({ withTimezone: true }),
    returnedDeviceId: text(),
    ...timestamps,
  },
  (t) => [index('visit_tag_visit_idx').on(t.visitId), index('visit_tag_tag_idx').on(t.tagId)],
);

/** SRS §9.1 AccessPermission — authorized zones + time window for a visit. */
export const accessPermission = pgTable('access_permission', {
  id,
  visitId: uuid()
    .notNull()
    .references(() => visit.id, { onDelete: 'cascade' }),
  zoneId: uuid()
    .notNull()
    .references(() => accessZone.id, { onDelete: 'cascade' }),
  startTime: timestamp({ withTimezone: true }),
  endTime: timestamp({ withTimezone: true }),
  escortRequired: boolean().notNull().default(false),
  status: accessPermissionStatus().notNull().default('pending'),
  ...timestamps,
});
