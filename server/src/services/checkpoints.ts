/**
 * Checkpoint events — a visitor's movement trail across an institution's checkpoints (each
 * checkpoint is a registered device). Written on check-in, check-out, and internal passage scans.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { schema } from '@vms/shared';
import { db, type Database } from '../db.ts';
import { emitVisitLocation } from '../realtime.ts';

type CheckpointKind = (typeof schema.checkpointEventKind.enumValues)[number];

/** Record a credential presentation at a checkpoint. Pass a tx to write inside an existing one. */
export async function recordCheckpointEvent(
  conn: Database,
  input: {
    visitId: string;
    deviceId?: string | null;
    kind: CheckpointKind;
    method?: string | null;
    verifiedBy?: string | null;
  },
): Promise<void> {
  await conn.insert(schema.checkpointEvent).values({
    visitId: input.visitId,
    deviceId: input.deviceId ?? null,
    kind: input.kind,
    method: input.method ?? null,
    verifiedBy: input.verifiedBy ?? null,
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
    if (!map.has(r.visitId))
      map.set(r.visitId, { checkpoint: r.checkpoint, kind: r.kind, at: r.at });
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
