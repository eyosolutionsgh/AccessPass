/**
 * Visitors, hosts, configurable visitor categories, and the security watchlist.
 * SRS §9.1 (Visitor, Employee/Host), FR-101 (categories), Watchlist (§2.4, FR-072).
 *
 * PII minimisation (SRS §9.2/§11.4): sensitive identifiers (ID/passport) are stored
 * AES-256-GCM encrypted in `idReferenceEnc`; never store raw secret values in plain text.
 */
import { boolean, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { organization, user } from './auth.ts';
import { department, office, facility } from './locations.ts';

/** SRS FR-101 — admin-configurable visitor category with per-category requirements. */
export const visitorCategory = pgTable('visitor_category', {
  id,
  organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
  name: text().notNull(),
  code: text().notNull(),
  /** Extra required pre-registration fields for this category (SRS FR-032). */
  requiredFields: jsonb().$type<string[]>().notNull().default([]),
  requiresApproval: boolean().notNull().default(false),
  requiresEscort: boolean().notNull().default(false),
  requiresInduction: boolean().notNull().default(false),
  /** Badge template config (fields/layout) — SRS FR-051/101, Appendix B. */
  badgeTemplate: jsonb().$type<Record<string, unknown>>(),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

/** SRS §9.1 Employee/Host — may be synced from a directory (externalId) or maintained locally. */
export const host = pgTable('host', {
  id,
  organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
  /** Optional link to a staff login account (a host who also signs in). */
  userId: text().references(() => user.id, { onDelete: 'set null' }),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  departmentId: uuid().references(() => department.id, { onDelete: 'set null' }),
  officeId: uuid().references(() => office.id, { onDelete: 'set null' }),
  facilityId: uuid().references(() => facility.id, { onDelete: 'set null' }),
  /** Directory/HR identifier for sync + deactivation (SRS §10.4). */
  externalId: text(),
  isActive: boolean().notNull().default(true),
  /** Optional admin note for why a host is inactive (e.g. "resigned", "on leave until Aug"). */
  availabilityNote: text(),
  ...timestamps,
});

/** SRS §9.1 Visitor — store only necessary PII. */
export const visitor = pgTable('visitor', {
  id,
  fullName: text().notNull(),
  organization: text(),
  email: text(),
  phone: text(),
  /** AES-256-GCM ciphertext of an ID/passport reference (SRS §9.2 sensitive identifier). */
  idReferenceEnc: text(),
  /** Risk markers surfaced to security (SRS §9.1). */
  riskFlags: jsonb().$type<string[]>().notNull().default([]),
  notes: text(),
  ...timestamps,
});

/** SRS Watchlist — controlled list to flag blocked/restricted/high-risk visitors (FR-072). */
export const watchlistEntry = pgTable('watchlist_entry', {
  id,
  organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
  /** What to match on: name | email | phone | id_reference. */
  matchType: text().notNull(),
  /** HMAC/normalised value to match against (avoid storing raw PII where possible). */
  matchValueHash: text().notNull(),
  reason: text(),
  isActive: boolean().notNull().default(true),
  createdBy: text().references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
});
