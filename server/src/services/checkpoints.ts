/**
 * Checkpoint events — a visitor's movement trail across an institution's checkpoints (each
 * checkpoint is a registered device). Written on check-in, check-out, and internal passage scans.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { schema, type CheckInLookup } from '@vms/shared';
import { db, type Database } from '../db.ts';
import { hashCode, hashToken } from '../lib/crypto.ts';
import { emitVisitLocation } from '../realtime.ts';

type CheckpointKind = (typeof schema.checkpointEventKind.enumValues)[number];

/** Record a credential presentation at a checkpoint. Pass a tx to write inside an existing one. */
export async function recordCheckpointEvent(
  conn: Database,
  input: { visitId: string; deviceId?: string | null; kind: CheckpointKind; method?: string | null },
): Promise<void> {
  await conn.insert(schema.checkpointEvent).values({
    visitId: input.visitId,
    deviceId: input.deviceId ?? null,
    kind: input.kind,
    method: input.method ?? null,
  });
}

/** The visit's latest checkpoint = the visitor's current location (with checkpoint name). */
export async function currentCheckpoint(visitId: string) {
  const [latest] = await db
    .select({
      deviceId: schema.checkpointEvent.deviceId,
      checkpoint: schema.deviceProfile.label,
      kind: schema.checkpointEvent.kind,
      at: schema.checkpointEvent.at,
    })
    .from(schema.checkpointEvent)
    .leftJoin(
      schema.deviceProfile,
      eq(schema.deviceProfile.deviceId, schema.checkpointEvent.deviceId),
    )
    .where(eq(schema.checkpointEvent.visitId, visitId))
    .orderBy(desc(schema.checkpointEvent.at))
    .limit(1);
  return latest ?? null;
}

/** Latest checkpoint per visit (newest wins), for annotating a list of visits with live location. */
export async function currentLocations(visitIds: string[]) {
  const map = new Map<string, { checkpoint: string | null; kind: string; at: Date }>();
  if (visitIds.length === 0) return map;
  const rows = await db
    .select({
      visitId: schema.checkpointEvent.visitId,
      checkpoint: schema.deviceProfile.label,
      kind: schema.checkpointEvent.kind,
      at: schema.checkpointEvent.at,
    })
    .from(schema.checkpointEvent)
    .leftJoin(
      schema.deviceProfile,
      eq(schema.deviceProfile.deviceId, schema.checkpointEvent.deviceId),
    )
    .where(inArray(schema.checkpointEvent.visitId, visitIds))
    .orderBy(desc(schema.checkpointEvent.at));
  for (const r of rows) {
    if (!map.has(r.visitId)) map.set(r.visitId, { checkpoint: r.checkpoint, kind: r.kind, at: r.at });
  }
  return map;
}

/**
 * Broadcast the visitor's just-recorded location to the host (and staff dashboards) so they can
 * see where the visitor is in real time. Call AFTER recordCheckpointEvent. Never throws — a
 * realtime hiccup must not break check-in/passage.
 */
export async function announceCheckpoint(visitId: string): Promise<void> {
  try {
    const latest = await currentCheckpoint(visitId);
    if (!latest) return;
    const [v] = await db
      .select({
        hostId: schema.visit.hostId,
        facilityId: schema.visit.facilityId,
        visitorName: schema.visitor.fullName,
      })
      .from(schema.visit)
      .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
      .where(eq(schema.visit.id, visitId));
    emitVisitLocation({
      visitId,
      hostId: v?.hostId ?? null,
      facilityId: v?.facilityId ?? null,
      visitorName: v?.visitorName ?? null,
      checkpoint: latest.checkpoint ?? null,
      kind: latest.kind,
      at: (latest.at instanceof Date ? latest.at : new Date(latest.at)).toISOString(),
    });
  } catch {
    /* realtime is best-effort */
  }
}

/** A visit's checkpoint trail (entry → internal passages → exit), oldest first, with checkpoint names. */
export function visitCheckpointTrail(visitId: string) {
  return db
    .select({
      id: schema.checkpointEvent.id,
      deviceId: schema.checkpointEvent.deviceId,
      checkpoint: schema.deviceProfile.label,
      kind: schema.checkpointEvent.kind,
      method: schema.checkpointEvent.method,
      at: schema.checkpointEvent.at,
    })
    .from(schema.checkpointEvent)
    .leftJoin(
      schema.deviceProfile,
      eq(schema.deviceProfile.deviceId, schema.checkpointEvent.deviceId),
    )
    .where(eq(schema.checkpointEvent.visitId, visitId))
    .orderBy(schema.checkpointEvent.at);
}

export type PassageResult =
  | { ok: true; visitorName: string | null; hostName: string | null; checkpoint: string | null }
  | { ok: false; message: string };

/**
 * Internal-checkpoint scan: a checked-in visitor presents their QR/code at a checkpoint. Logs a
 * `passage` event (does NOT change check-in/out state) and returns who they are + the checkpoint.
 */
export async function passageScan(
  lookup: CheckInLookup,
  ctx: { deviceId?: string },
): Promise<PassageResult> {
  const [inv] =
    lookup.kind === 'qr'
      ? await db
          .select({ visitId: schema.visitInvitation.visitId })
          .from(schema.visitInvitation)
          .where(eq(schema.visitInvitation.qrTokenHash, hashToken(lookup.token)))
          .limit(1)
      : await db
          .select({ visitId: schema.visitInvitation.visitId })
          .from(schema.visitInvitation)
          .where(eq(schema.visitInvitation.codeHash, hashCode(lookup.code)))
          .limit(1);
  if (!inv?.visitId) return { ok: false, message: 'No matching visit. Please see reception.' };

  const [v] = await db
    .select({
      status: schema.visit.status,
      visitorName: schema.visitor.fullName,
      hostName: schema.host.name,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .where(eq(schema.visit.id, inv.visitId));
  if (!v || v.status !== 'checked_in') {
    return { ok: false, message: 'This visitor is not currently checked in.' };
  }

  await recordCheckpointEvent(db, {
    visitId: inv.visitId,
    deviceId: ctx.deviceId,
    kind: 'passage',
    method: lookup.kind,
  });
  await announceCheckpoint(inv.visitId);

  let checkpoint: string | null = null;
  if (ctx.deviceId) {
    const [d] = await db
      .select({ label: schema.deviceProfile.label })
      .from(schema.deviceProfile)
      .where(eq(schema.deviceProfile.deviceId, ctx.deviceId))
      .limit(1);
    checkpoint = d?.label ?? null;
  }
  return { ok: true, visitorName: v.visitorName, hostName: v.hostName, checkpoint };
}

/** Recent visitors seen at a checkpoint (device), newest first. */
export function checkpointLog(deviceId: string, limit = 50) {
  return db
    .select({
      id: schema.checkpointEvent.id,
      visitId: schema.checkpointEvent.visitId,
      visitorName: schema.visitor.fullName,
      kind: schema.checkpointEvent.kind,
      method: schema.checkpointEvent.method,
      at: schema.checkpointEvent.at,
    })
    .from(schema.checkpointEvent)
    .leftJoin(schema.visit, eq(schema.visit.id, schema.checkpointEvent.visitId))
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .where(eq(schema.checkpointEvent.deviceId, deviceId))
    .orderBy(desc(schema.checkpointEvent.at))
    .limit(limit);
}
