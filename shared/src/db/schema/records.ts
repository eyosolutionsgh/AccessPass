/**
 * Cross-cutting records: signed documents/consents, notifications, the audit trail, and
 * security incidents/exceptions. SRS §9.1, §10.2, §11.3, §13.
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.ts';
import { user } from './auth.ts';
import {
  auditActorKind,
  auditResult,
  documentType,
  incidentSeverity,
  incidentStatus,
  incidentType,
  notificationChannel,
  notificationStatus,
} from './enums.ts';
import { visit } from './visits.ts';
import { visitor } from './visitors.ts';

/** SRS §9.1 Document/Consent — NDAs, site rules, privacy acks, permits, ID images, photos. */
export const documentRecord = pgTable('document_record', {
  id,
  visitId: uuid().references(() => visit.id, { onDelete: 'cascade' }),
  visitorId: uuid().references(() => visitor.id, { onDelete: 'cascade' }),
  type: documentType().notNull(),
  version: text(),
  signedAt: timestamp({ withTimezone: true }),
  /** Object-storage key (MinIO/S3) — not the file contents. */
  storageReference: text(),
  status: text().notNull().default('active'),
  ...timestamps,
});

/** SRS §9.1 Notification — supports troubleshooting + compliance evidence (FR-074). */
export const notification = pgTable('notification', {
  id,
  visitId: uuid().references(() => visit.id, { onDelete: 'cascade' }),
  recipient: text().notNull(),
  channel: notificationChannel().notNull(),
  template: text(),
  status: notificationStatus().notNull().default('queued'),
  attemptCount: integer().notNull().default(0),
  sentAt: timestamp({ withTimezone: true }),
  failureReason: text(),
  /** Transport/provider message id (SMTP messageId, SMS gateway id) for delivery tracing. */
  providerMessageId: text(),
  /** When the next delivery retry is scheduled, while status is 'queued' pending a retry job. */
  nextRetryAt: timestamp({ withTimezone: true }),
  /** Set when a channel reports confirmed delivery (SMS/push receipts); email stops at 'sent'. */
  deliveredAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/**
 * SRS §9.1 AuditLog — tamper-evident, append-only. No updatedAt; rows are never modified.
 * Secret tokens are never logged in full (SRS QR-SEC-07).
 */
export const auditLog = pgTable('audit_log', {
  id,
  /** Monotonic sequence — deterministic order for walking the tamper-evident hash-chain. */
  seq: bigint({ mode: 'number' }).generatedAlwaysAsIdentity(),
  actorId: text().references(() => user.id, { onDelete: 'set null' }),
  actorRole: text(),
  /** Who acted: a logged-in user (default), the system (auto-detections), or an AI agent. */
  actorKind: auditActorKind().notNull().default('human'),
  action: text().notNull(),
  objectType: text(),
  objectId: text(),
  result: auditResult().notNull().default('success'),
  sourceIp: text(),
  deviceId: text(),
  /** Change summary / contextual detail (no secrets). */
  metadata: jsonb().$type<Record<string, unknown>>(),
  /** Optional hash-chain link to the previous entry for tamper evidence (SRS §11.3). */
  prevHash: text(),
  hash: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** SRS §9.1 Incident/Exception — watchlist hits, denials, duplicates, overstays, breaches. */
export const incident = pgTable('incident', {
  id,
  visitId: uuid().references(() => visit.id, { onDelete: 'set null' }),
  type: incidentType().notNull(),
  severity: incidentSeverity().notNull().default('low'),
  status: incidentStatus().notNull().default('open'),
  description: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  /** Semantic embedding of the incident text (bge-m3 = 1024-dim) for AI similar-incident search. */
  embedding: vector({ dimensions: 1024 }),
  resolvedBy: text().references(() => user.id, { onDelete: 'set null' }),
  resolvedAt: timestamp({ withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('incident_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
]);
