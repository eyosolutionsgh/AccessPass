/**
 * Points, devices, point staffing, and the per-visitor checkpoint trail.
 *
 * A **point** is a fixed operating location (a reception desk, a security checkpoint). A **device**
 * (`device_profile`) is a physical tablet stationed at a point — reassignable, so a faulty device
 * can be swapped by pointing a replacement at the same point without losing the point's identity,
 * its staffing, or the visitor trail. Users are assigned to points (`point_assignment`) and may
 * only sign a device in at a point they're assigned to (`device_session` tracks who is live).
 */
import { boolean, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { user } from './auth.ts';
import { checkpointEventKind, pointKind } from './enums.ts';
import { facility } from './locations.ts';
import { visit } from './visits.ts';

/** A fixed operating location a device is stationed at (e.g. "Main Reception", "Gate 2"). */
export const point = pgTable('point', {
  id,
  facilityId: uuid().references(() => facility.id, { onDelete: 'set null' }),
  name: text().notNull(),
  kind: pointKind().notNull().default('checkpoint'),
  /** Soft-delete flag — a deactivated point drops out of pickers and oversight. */
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

/** One row per kiosk/checkpoint device, optionally stationed at a point. `profile` is DeviceProfile JSON. */
export const deviceProfile = pgTable('device_profile', {
  id,
  /** Stable device identifier the kiosk reports. */
  deviceId: text().notNull().unique(),
  /** Human device name, e.g. "Lobby tablet 1". The operating-location name comes from its point. */
  label: text(),
  facilityId: uuid().references(() => facility.id, { onDelete: 'set null' }),
  /** The point this device is currently stationed at (reassignable; null = unassigned/spare). */
  pointId: uuid().references(() => point.id, { onDelete: 'set null' }),
  /** DeviceProfile JSON: { deviceType, scannerSource, printerTarget, nfcEnabled, credentialMode, … } */
  profile: jsonb().$type<Record<string, unknown>>().notNull(),
  /** Soft-delete flag — a deactivated device drops out of the active admin list. */
  isActive: boolean().notNull().default(true),
  /** HMAC of the current one-time pairing code an admin issued to bind a tablet (null once redeemed). */
  pairingCodeHash: text(),
  /** When the active pairing code expires; redeeming after this is rejected. */
  pairingExpiresAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/** Who may operate a point — a staff member must be assigned before they can sign a device in there. */
export const pointAssignment = pgTable(
  'point_assignment',
  {
    id,
    pointId: uuid()
      .notNull()
      .references(() => point.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [unique('point_assignment_point_user_uq').on(t.pointId, t.userId)],
);

/**
 * A staffing session at a device: opened when a staff member signs the device in at its point,
 * closed on sign-out. An open row (`signedOutAt IS NULL`) means someone is live at that device —
 * this drives the admin's "who is signed in where" oversight.
 */
export const deviceSession = pgTable(
  'device_session',
  {
    id,
    /** The physical device signed in (matches device_profile.deviceId). */
    deviceId: text().notNull(),
    /** The point the device was stationed at when signed in (snapshot). */
    pointId: uuid().references(() => point.id, { onDelete: 'set null' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    signedInAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    signedOutAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('device_session_device_idx').on(t.deviceId),
    index('device_session_open_idx').on(t.signedOutAt),
  ],
);

/** One row per credential presentation at a checkpoint — the visitor's movement trail. */
export const checkpointEvent = pgTable(
  'checkpoint_event',
  {
    id,
    visitId: uuid()
      .notNull()
      .references(() => visit.id, { onDelete: 'cascade' }),
    /** Physical device where it happened (matches device_profile.deviceId). */
    deviceId: text(),
    /** The point the device was stationed at (snapshot) — keeps the trail stable across device swaps. */
    pointId: uuid().references(() => point.id, { onDelete: 'set null' }),
    kind: checkpointEventKind().notNull(),
    /** How the credential was presented: qr/code/nfc/tag. */
    method: text(),
    /** Staff member (e.g. guard) who verified this passage, when scanned from an authenticated device. */
    verifiedBy: text().references(() => user.id, { onDelete: 'set null' }),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('checkpoint_event_visit_idx').on(t.visitId),
    index('checkpoint_event_device_idx').on(t.deviceId),
  ],
);
