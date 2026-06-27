/**
 * Points (fixed operating locations), the staff assigned to operate them, and live device
 * staffing sessions. A staff member may only sign a device in at a point they're assigned to;
 * admins (config:manage) bypass as break-glass so initial setup is never locked out.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  anyRoleHasPermission,
  schema,
  type PointAssignInput,
  type pointCreateSchema,
  type pointUpdateSchema,
  type AdminSetActiveInput,
} from '@vms/shared';
import { type z } from 'zod';
import { db } from '../db.ts';
import { recordAudit } from '../lib/audit.ts';

type Actor = { id: string; role?: string | null };

/** Thrown when a staff member tries to sign a device in at a point they can't operate. */
export class PointAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PointAccessError';
  }
}

// ── Points CRUD ───────────────────────────────────────────────────────────────
export function listPoints() {
  return db
    .select({
      id: schema.point.id,
      name: schema.point.name,
      kind: schema.point.kind,
      facilityId: schema.point.facilityId,
      facilityName: schema.facility.name,
      isActive: schema.point.isActive,
      assignedCount: sql<number>`(select count(*)::int from ${schema.pointAssignment} where ${schema.pointAssignment.pointId} = ${schema.point.id})`,
      deviceCount: sql<number>`(select count(*)::int from ${schema.deviceProfile} where ${schema.deviceProfile.pointId} = ${schema.point.id} and ${schema.deviceProfile.isActive} = true)`,
      createdAt: schema.point.createdAt,
    })
    .from(schema.point)
    .leftJoin(schema.facility, eq(schema.facility.id, schema.point.facilityId))
    .orderBy(desc(schema.point.createdAt));
}

export async function createPoint(input: z.infer<typeof pointCreateSchema>, actor: Actor) {
  const [row] = await db
    .insert(schema.point)
    .values({ name: input.name, kind: input.kind, facilityId: input.facilityId ?? null })
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'point.create',
    objectType: 'point',
    objectId: row?.id,
  });
  return row;
}

export async function updatePoint(input: z.infer<typeof pointUpdateSchema>, actor: Actor) {
  const { id, facilityId, ...rest } = input;
  const [row] = await db
    .update(schema.point)
    .set({ ...rest, ...(facilityId !== undefined ? { facilityId: facilityId ?? null } : {}) })
    .where(eq(schema.point.id, id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'point.update',
    objectType: 'point',
    objectId: id,
  });
  return row;
}

/** Soft-delete / restore a point. Deactivating keeps its devices + trail but hides it from pickers. */
export async function setPointActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.point)
    .set({ isActive: input.isActive })
    .where(eq(schema.point.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'point.set_active',
    objectType: 'point',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

// ── Staffing assignments ────────────────────────────────────────────────────
/** The staff currently allowed to operate a point. */
export function listPointAssignments(pointId: string) {
  return db
    .select({
      userId: schema.pointAssignment.userId,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.pointAssignment)
    .leftJoin(schema.user, eq(schema.user.id, schema.pointAssignment.userId))
    .where(eq(schema.pointAssignment.pointId, pointId));
}

/** Replace the full set of staff assigned to a point. */
export async function setPointAssignments(input: PointAssignInput, actor: Actor) {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.pointAssignment)
      .where(eq(schema.pointAssignment.pointId, input.pointId));
    if (input.userIds.length > 0) {
      await tx
        .insert(schema.pointAssignment)
        .values(input.userIds.map((userId) => ({ pointId: input.pointId, userId })));
    }
  });
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'point.assign',
    objectType: 'point',
    objectId: input.pointId,
    metadata: { count: input.userIds.length },
  });
  return { count: input.userIds.length };
}

// ── Device login gate + live sessions ────────────────────────────────────────
/**
 * Verify `actor` may sign device `deviceId` in: the device must be registered, active, assigned to
 * an active point, and the actor must be assigned to that point (admins bypass). Returns the
 * resolved point, or throws PointAccessError with a user-facing reason.
 */
export async function assertDeviceLogin(
  actor: Actor,
  deviceId: string,
): Promise<{ pointId: string; pointName: string }> {
  const [d] = await db
    .select({ pointId: schema.deviceProfile.pointId, isActive: schema.deviceProfile.isActive })
    .from(schema.deviceProfile)
    .where(eq(schema.deviceProfile.deviceId, deviceId));
  if (!d) {
    throw new PointAccessError(
      'This device is not registered. Ask an admin to register it and assign it to a point.',
    );
  }
  if (!d.isActive) throw new PointAccessError('This device has been deactivated by an admin.');
  if (!d.pointId) {
    throw new PointAccessError(
      'This device is not assigned to a point yet. Ask an admin to assign it.',
    );
  }
  const [pt] = await db
    .select({ name: schema.point.name, isActive: schema.point.isActive })
    .from(schema.point)
    .where(eq(schema.point.id, d.pointId));
  if (!pt || !pt.isActive) {
    throw new PointAccessError("This device's point is inactive. Ask an admin.");
  }
  // Admin break-glass — never lock admins out of a post during setup/inspection.
  if (anyRoleHasPermission(actor.role ?? null, { config: ['manage'] })) {
    return { pointId: d.pointId, pointName: pt.name };
  }
  const [assigned] = await db
    .select({ id: schema.pointAssignment.id })
    .from(schema.pointAssignment)
    .where(
      and(
        eq(schema.pointAssignment.pointId, d.pointId),
        eq(schema.pointAssignment.userId, actor.id),
      ),
    );
  if (!assigned) {
    throw new PointAccessError(
      `You are not assigned to "${pt.name}", so you can't operate this device. Ask an admin to assign you to this point.`,
    );
  }
  return { pointId: d.pointId, pointName: pt.name };
}

/** Open a staffing session for a device, superseding any stale open session on the same device. */
export async function openDeviceSession(input: {
  deviceId: string;
  pointId: string;
  userId: string;
}) {
  await db
    .update(schema.deviceSession)
    .set({ signedOutAt: new Date() })
    .where(
      and(
        eq(schema.deviceSession.deviceId, input.deviceId),
        isNull(schema.deviceSession.signedOutAt),
      ),
    );
  const [row] = await db
    .insert(schema.deviceSession)
    .values({ deviceId: input.deviceId, pointId: input.pointId, userId: input.userId })
    .returning();
  return row;
}

/** Close the actor's open session on a device (sign-out). */
export async function closeDeviceSession(deviceId: string, userId: string) {
  await db
    .update(schema.deviceSession)
    .set({ signedOutAt: new Date() })
    .where(
      and(
        eq(schema.deviceSession.deviceId, deviceId),
        eq(schema.deviceSession.userId, userId),
        isNull(schema.deviceSession.signedOutAt),
      ),
    );
}

/**
 * Every device with its point and current staffing — the admin's "who is signed in where"
 * oversight. `session` is null when nobody is currently signed in at that device.
 */
export async function devicesStatus() {
  const devices = await db
    .select({
      id: schema.deviceProfile.id,
      deviceId: schema.deviceProfile.deviceId,
      label: schema.deviceProfile.label,
      facilityId: schema.deviceProfile.facilityId,
      pointId: schema.deviceProfile.pointId,
      pointName: schema.point.name,
      pointKind: schema.point.kind,
      profile: schema.deviceProfile.profile,
      isActive: schema.deviceProfile.isActive,
      createdAt: schema.deviceProfile.createdAt,
    })
    .from(schema.deviceProfile)
    .leftJoin(schema.point, eq(schema.point.id, schema.deviceProfile.pointId))
    .orderBy(desc(schema.deviceProfile.createdAt));

  const open = await db
    .select({
      deviceId: schema.deviceSession.deviceId,
      userId: schema.deviceSession.userId,
      userName: schema.user.name,
      signedInAt: schema.deviceSession.signedInAt,
    })
    .from(schema.deviceSession)
    .leftJoin(schema.user, eq(schema.user.id, schema.deviceSession.userId))
    .where(isNull(schema.deviceSession.signedOutAt))
    .orderBy(desc(schema.deviceSession.signedInAt));
  const byDevice = new Map<string, (typeof open)[number]>();
  for (const s of open) if (!byDevice.has(s.deviceId)) byDevice.set(s.deviceId, s);

  return devices.map((d) => {
    const s = byDevice.get(d.deviceId);
    return {
      ...d,
      session: s
        ? { userId: s.userId, userName: s.userName, signedInAt: s.signedInAt.toISOString() }
        : null,
    };
  });
}
