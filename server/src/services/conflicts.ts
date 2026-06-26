/**
 * Scheduling clash detection (SRS FR-013). An appointment "clashes" when its time window
 * overlaps an existing occupying visit on ANY of three dimensions: the same officer (host),
 * the same room/office, or the same visitor. Overlap uses a half-open interval
 * [arrival, departure) so back-to-back bookings (one ends exactly as the next begins) do NOT clash.
 */
import { and, eq, gt, inArray, isNotNull, lt, ne, or } from 'drizzle-orm';
import { OCCUPYING_VISIT_STATUSES, schema, type VisitStatusValue } from '@vms/shared';
import { db } from '../db.ts';

export type ConflictDimension = 'host' | 'office' | 'visitor';

export interface VisitConflict {
  visitId: string;
  /** Which slot(s) this existing visit collides on. */
  dimensions: ConflictDimension[];
  status: VisitStatusValue;
  expectedArrival: Date | null;
  expectedDeparture: Date | null;
  hostName: string | null;
  visitorName: string | null;
}

export interface FindConflictsArgs {
  hostId: string;
  /** null when the host has no office assigned — the room dimension is then skipped. */
  officeId: string | null;
  visitorId: string;
  start: Date;
  end: Date;
  /** Ignore this visit (its own row) when rescheduling/approving. */
  excludeVisitId?: string;
}

/** Thrown by the appointment services; the tRPC layer maps it to a 409 CONFLICT. */
export class SchedulingConflictError extends Error {
  conflicts: VisitConflict[];
  constructor(conflicts: VisitConflict[]) {
    super('Scheduling conflict');
    this.name = 'SchedulingConflictError';
    this.conflicts = conflicts;
  }
}

/**
 * Return every occupying visit whose window overlaps [start, end) on the host, room, or visitor.
 * Empty array means the slot is free.
 */
export async function findConflicts(args: FindConflictsArgs): Promise<VisitConflict[]> {
  const dimensions = [
    eq(schema.visit.hostId, args.hostId),
    eq(schema.visit.visitorId, args.visitorId),
  ];
  if (args.officeId) dimensions.push(eq(schema.visit.officeId, args.officeId));

  const conditions = [
    inArray(schema.visit.status, [...OCCUPYING_VISIT_STATUSES]),
    isNotNull(schema.visit.expectedArrival),
    isNotNull(schema.visit.expectedDeparture),
    // half-open overlap: existing.start < new.end AND existing.end > new.start
    lt(schema.visit.expectedArrival, args.end),
    gt(schema.visit.expectedDeparture, args.start),
    or(...dimensions),
  ];
  if (args.excludeVisitId) conditions.push(ne(schema.visit.id, args.excludeVisitId));

  const rows = await db
    .select({
      visitId: schema.visit.id,
      status: schema.visit.status,
      hostId: schema.visit.hostId,
      officeId: schema.visit.officeId,
      visitorId: schema.visit.visitorId,
      expectedArrival: schema.visit.expectedArrival,
      expectedDeparture: schema.visit.expectedDeparture,
      hostName: schema.host.name,
      visitorName: schema.visitor.fullName,
    })
    .from(schema.visit)
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .where(and(...conditions));

  return rows.map((r) => {
    const dims: ConflictDimension[] = [];
    if (r.hostId === args.hostId) dims.push('host');
    if (args.officeId && r.officeId === args.officeId) dims.push('office');
    if (r.visitorId === args.visitorId) dims.push('visitor');
    return {
      visitId: r.visitId,
      dimensions: dims,
      status: r.status,
      expectedArrival: r.expectedArrival,
      expectedDeparture: r.expectedDeparture,
      hostName: r.hostName,
      visitorName: r.visitorName,
    };
  });
}
