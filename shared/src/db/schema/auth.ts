/**
 * better-auth tables. Field names (JS keys) match better-auth's model fields exactly so the
 * drizzleAdapter maps cleanly; DB columns are snake_cased by the drizzle-kit casing config.
 *
 * Includes core (user/session/account/verification) plus the plugins this project enables:
 *  - admin       → user.role, user.banned/banReason/banExpires, session.impersonatedBy
 *  - organization → organization/member/invitation, session.activeOrganizationId
 *  - jwt         → jwks
 */
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  // admin plugin
  role: text(),
  banned: boolean().default(false),
  banReason: text(),
  banExpires: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // admin plugin
  impersonatedBy: text(),
  // organization plugin
  activeOrganizationId: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** organization plugin — used to scope RBAC per facility/site. */
export const organization = pgTable('organization', {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const member = pgTable('member', {
  id: text().primaryKey(),
  organizationId: text()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text().notNull().default('member'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Org-membership invitations (distinct from visitor invitations — see visits.ts). */
export const invitation = pgTable('invitation', {
  id: text().primaryKey(),
  organizationId: text()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  role: text(),
  status: text().notNull().default('pending'),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  inviterId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

/** jwt plugin — signing keys for issued JWTs (kiosk/API tokens). */
export const jwks = pgTable('jwks', {
  id: text().primaryKey(),
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
