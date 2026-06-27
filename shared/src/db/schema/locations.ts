/**
 * Facility structure — SRS FR-100. Administrators configure facility, buildings, floors,
 * reception points, access zones, and departments. Optionally scoped to a better-auth
 * organization for per-site RBAC.
 */
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { organization } from './auth.ts';

export const facility = pgTable('facility', {
  id,
  organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
  name: text().notNull(),
  code: text().notNull().unique(),
  address: text(),
  /** IANA timezone, e.g. "Africa/Accra" — SRS §9.4 facility-local display. */
  timezone: text().notNull().default('UTC'),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

export const building = pgTable('building', {
  id,
  facilityId: uuid()
    .notNull()
    .references(() => facility.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  floors: integer().notNull().default(1),
  ...timestamps,
});

export const accessZone = pgTable('access_zone', {
  id,
  facilityId: uuid()
    .notNull()
    .references(() => facility.id, { onDelete: 'cascade' }),
  buildingId: uuid().references(() => building.id, { onDelete: 'set null' }),
  name: text().notNull(),
  /** Whether visitors in this zone always require an escort (SRS FR-063). */
  escortRequired: boolean().notNull().default(false),
  ...timestamps,
});

export const department = pgTable('department', {
  id,
  facilityId: uuid().references(() => facility.id, { onDelete: 'set null' }),
  name: text().notNull(),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

/**
 * Offices / rooms within a department (SRS FR-100) — e.g. "Minister's Office" or "Room 13"
 * under Administration. Staff (hosts) belong to an office, so a visit's department + office are
 * known from the host being visited.
 */
export const office = pgTable('office', {
  id,
  departmentId: uuid()
    .notNull()
    .references(() => department.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});
