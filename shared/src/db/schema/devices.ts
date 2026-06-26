/**
 * Device/checkpoint registry + the per-visitor checkpoint trail.
 * A registered device IS a checkpoint (its `label` is the checkpoint name). The `profile` JSON
 * drives how check-in behaves on that device (scanner source, printer target, credential mode).
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { user } from './auth.ts';
import { checkpointEventKind } from './enums.ts';
import { facility } from './locations.ts';
import { visit } from './visits.ts';

/** One row per kiosk/checkpoint device. `profile` is a DeviceProfile object (validated by zod). */
export const deviceProfile = pgTable('device_profile', {
  id,
  /** Stable device identifier the kiosk reports — also keys the checkpoint. */
  deviceId: text().notNull().unique(),
  /** Human checkpoint name, e.g. "Main Entrance". */
  label: text(),
  facilityId: uuid().references(() => facility.id, { onDelete: 'set null' }),
  /** DeviceProfile JSON: { deviceType, scannerSource, printerTarget, nfcEnabled, credentialMode, … } */
  profile: jsonb().$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

/** One row per credential presentation at a checkpoint — the visitor's movement trail. */
export const checkpointEvent = pgTable(
  'checkpoint_event',
  {
    id,
    visitId: uuid()
      .notNull()
      .references(() => visit.id, { onDelete: 'cascade' }),
    /** Checkpoint/device where it happened (matches device_profile.deviceId). */
    deviceId: text(),
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
