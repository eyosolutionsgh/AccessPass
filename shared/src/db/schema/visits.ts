/**
 * Visit/appointment lifecycle plus the invitation code + QR token (SRS §6.2, §6.3, §7, §9.1).
 *
 * Security (SRS §7.5): invitation codes and QR tokens are stored ONLY as hashes
 * (`codeHash`, `qrTokenHash`) — never the raw secret. Validation re-hashes the presented
 * value server-side. The QR payload is an HTTPS URL carrying an opaque/signed token (QR-005).
 */
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { user } from './auth.ts';
import { invitationStatus, preRegStatus, visitOrigin, visitStatus } from './enums.ts';
import { department, facility, office } from './locations.ts';
import { host, visitor, visitorCategory } from './visitors.ts';

export const visit = pgTable(
  'visit',
  {
    id,
    visitorId: uuid()
      .notNull()
      .references(() => visitor.id, { onDelete: 'restrict' }),
    /**
     * The officer being visited. NULL for walk-ins directed only to a department/office where no
     * specific person is named yet (an enquiry); always set for scheduled appointments.
     */
    hostId: uuid().references(() => host.id, { onDelete: 'restrict' }),
    facilityId: uuid()
      .notNull()
      .references(() => facility.id, { onDelete: 'restrict' }),
    /** Department the visit/enquiry is directed to — primary target for a host-less walk-in. */
    departmentId: uuid().references(() => department.id, { onDelete: 'set null' }),
    /** Room/office the visit is held in — snapshotted from the host at creation for clash detection. */
    officeId: uuid().references(() => office.id, { onDelete: 'set null' }),
    categoryId: uuid().references(() => visitorCategory.id, { onDelete: 'set null' }),
    purpose: text(),
    /** Scheduled appointment vs. unscheduled walk-in registered at the desk. */
    origin: visitOrigin().notNull().default('appointment'),
    status: visitStatus().notNull().default('draft'),
    /** Expected arrival/departure (tz-aware; SRS FR-011). */
    expectedArrival: timestamp({ withTimezone: true }),
    expectedDeparture: timestamp({ withTimezone: true }),
    durationMinutes: integer(),
    /** Approved access zones for this visit (SRS FR-060). */
    requestedZoneIds: jsonb().$type<string[]>().notNull().default([]),
    escortRequired: text(), // role/name required to escort, null if none (SRS FR-063)
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    approvedBy: text().references(() => user.id, { onDelete: 'set null' }),
    approvedAt: timestamp({ withTimezone: true }),
    denialReason: text(),
    ...timestamps,
  },
  (t) => [
    // Speeds up overlap lookups against a host's existing bookings (clash detection).
    index('visit_host_window_idx').on(t.hostId, t.expectedArrival),
  ],
);

export const visitInvitation = pgTable('visit_invitation', {
  id,
  visitId: uuid()
    .notNull()
    .references(() => visit.id, { onDelete: 'cascade' }),
  /** Hash of the human-readable code (SRS QR-SEC-05) — raw code is never stored. */
  codeHash: text().notNull(),
  /** Hash of the QR token (SRS QR-SEC-05). */
  qrTokenHash: text().notNull(),
  status: invitationStatus().notNull().default('active'),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  /** Allowed arrival window around the appointment (SRS QR-006, §7.4). */
  allowedFrom: timestamp({ withTimezone: true }),
  allowedUntil: timestamp({ withTimezone: true }),
  resendCount: integer().notNull().default(0),
  revokedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const preRegistration = pgTable('pre_registration', {
  id,
  visitId: uuid()
    .notNull()
    .references(() => visit.id, { onDelete: 'cascade' }),
  status: preRegStatus().notNull().default('not_started'),
  submittedAt: timestamp({ withTimezone: true }),
  /** Per-field completion map (SRS FR-035). */
  requiredFieldsStatus: jsonb().$type<Record<string, boolean>>().notNull().default({}),
  /** Policy acknowledgements: privacy/NDA/safety/site-rules (SRS FR-033). */
  policyAckStatus: jsonb().$type<Record<string, boolean>>().notNull().default({}),
  consentGiven: text(), // timestamp string or null; consent record link in documents
  ...timestamps,
});
