import { createHash } from 'node:crypto';
import { asc, desc, isNotNull, sql } from 'drizzle-orm';
import { schema } from '@vms/shared';
import type { Database } from '../db.ts';
import { forwardAuditEvent } from '../services/siem.ts';

export type ActorKind = 'human' | 'system' | 'ai';

type AuditEntry = {
  actorId?: string | null;
  actorRole?: string | null;
  /** Who acted — defaults to 'human'. Use 'system' for auto-detections, 'ai' for agent actions. */
  actorKind?: ActorKind;
  action: string;
  objectType?: string;
  objectId?: string;
  result?: 'success' | 'failure' | 'denied';
  sourceIp?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
};

/** The fields covered by the tamper-evident hash (null-normalized so undefined/null hash alike). */
type HashedFields = {
  actorId: string | null;
  actorRole: string | null;
  actorKind: ActorKind;
  action: string;
  objectType: string | null;
  objectId: string | null;
  result: 'success' | 'failure' | 'denied';
  sourceIp: string | null;
  deviceId: string | null;
  metadata: Record<string, unknown> | null;
};

// Constant key for the audit-chain advisory lock (serializes chain writers process-wide).
const AUDIT_LOCK_KEY = 84217;

/** Deterministic JSON with recursively-sorted keys, so jsonb key-reordering can't change the hash. */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',')}}`;
}

function auditHash(fields: HashedFields, prevHash: string | null): string {
  return createHash('sha256')
    .update(canonical({ ...fields, prevHash }))
    .digest('hex');
}

function toHashedFields(entry: AuditEntry): HashedFields {
  return {
    actorId: entry.actorId ?? null,
    actorRole: entry.actorRole ?? null,
    actorKind: entry.actorKind ?? 'human',
    action: entry.action,
    objectType: entry.objectType ?? null,
    objectId: entry.objectId ?? null,
    result: entry.result ?? 'success',
    sourceIp: entry.sourceIp ?? null,
    deviceId: entry.deviceId ?? null,
    metadata: entry.metadata ?? null,
  };
}

/**
 * Append a tamper-evident audit-log entry (SRS §11.3): each row stores the previous row's hash and
 * its own hash over (its fields + prevHash), forming a chain that detects any later
 * deletion/modification. Writers are serialized with a Postgres advisory lock so the chain can't
 * fork under concurrency. Never put raw secrets/tokens in `metadata` — only masked refs (QR-SEC-07).
 */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  const fields = toHashedFields(entry);

  await db.transaction(async (tx) => {
    // Advisory lock is held until this short transaction commits — serializes chain appends.
    await tx.execute(sql`select pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);
    const [prev] = await tx
      .select({ hash: schema.auditLog.hash })
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.seq))
      .limit(1);
    const prevHash = prev?.hash ?? null;
    await tx.insert(schema.auditLog).values({
      actorId: fields.actorId,
      actorRole: fields.actorRole,
      actorKind: fields.actorKind,
      action: fields.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      result: fields.result,
      sourceIp: fields.sourceIp,
      deviceId: fields.deviceId,
      metadata: entry.metadata,
      prevHash,
      hash: auditHash(fields, prevHash),
    });
  });

  // Forward security-relevant events to the SIEM (SRS §10.4) — fire-and-forget.
  forwardAuditEvent(entry);
}

/**
 * Walk the hash-chain in sequence order, recomputing each hash + checking its link to the previous
 * row. Returns ok=false at the first row that was modified or whose predecessor was deleted.
 * Read-only — for periodic integrity checks and the AI audit analyst (SRS §11.3).
 */
export async function verifyAuditChain(
  db: Database,
): Promise<{ ok: boolean; checked: number; brokenAtId?: string }> {
  const rows = await db
    .select({
      id: schema.auditLog.id,
      actorId: schema.auditLog.actorId,
      actorRole: schema.auditLog.actorRole,
      actorKind: schema.auditLog.actorKind,
      action: schema.auditLog.action,
      objectType: schema.auditLog.objectType,
      objectId: schema.auditLog.objectId,
      result: schema.auditLog.result,
      sourceIp: schema.auditLog.sourceIp,
      deviceId: schema.auditLog.deviceId,
      metadata: schema.auditLog.metadata,
      prevHash: schema.auditLog.prevHash,
      hash: schema.auditLog.hash,
    })
    .from(schema.auditLog)
    .where(isNotNull(schema.auditLog.hash))
    .orderBy(asc(schema.auditLog.seq));

  let prev: string | null = null;
  let checked = 0;
  for (const row of rows) {
    const fields: HashedFields = {
      actorId: row.actorId,
      actorRole: row.actorRole,
      actorKind: row.actorKind,
      action: row.action,
      objectType: row.objectType ?? null,
      objectId: row.objectId ?? null,
      result: row.result,
      sourceIp: row.sourceIp,
      deviceId: row.deviceId,
      metadata: row.metadata ?? null,
    };
    if (row.prevHash !== prev || row.hash !== auditHash(fields, prev)) {
      return { ok: false, checked, brokenAtId: row.id };
    }
    prev = row.hash;
    checked++;
  }
  return { ok: true, checked };
}
