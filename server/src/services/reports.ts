import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { schema, type ReportRangeInput } from '@vms/shared';
import { db } from '../db.ts';

function rangeConditions(input: ReportRangeInput) {
  const c = [];
  if (input.facilityId) c.push(eq(schema.visit.facilityId, input.facilityId));
  if (input.from) c.push(gte(schema.visit.createdAt, input.from));
  if (input.to) c.push(lte(schema.visit.createdAt, input.to));
  return c;
}

/** Daily visitor log (SRS §12) — one row per visit with status and timings. */
export async function visitorLog(input: ReportRangeInput, limit = 1000) {
  const where = rangeConditions(input);
  return db
    .select({
      visitId: schema.visit.id,
      visitorName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      hostName: schema.host.name,
      facilityName: schema.facility.name,
      status: schema.visit.status,
      expectedArrival: schema.visit.expectedArrival,
      timeIn: schema.checkInRecord.timeIn,
      timeOut: schema.checkInRecord.timeOut,
      createdAt: schema.visit.createdAt,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
    .leftJoin(schema.checkInRecord, eq(schema.checkInRecord.visitId, schema.visit.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.visit.createdAt))
    .limit(limit);
}

/** Invitation/visit status breakdown (SRS §12 — invitation status report). */
export async function statusBreakdown(input: ReportRangeInput) {
  const where = rangeConditions(input);
  const rows = await db
    .select({ status: schema.visit.status, count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .where(where.length ? and(...where) : undefined)
    .groupBy(schema.visit.status);
  return rows;
}

/** Daily check-in volume for the visitor-volume dashboard (SRS §12). */
export async function dailyVolume(input: ReportRangeInput) {
  const c = [];
  if (input.from) c.push(gte(schema.checkInRecord.timeIn, input.from));
  if (input.to) c.push(lte(schema.checkInRecord.timeIn, input.to));
  const day = sql<string>`to_char(${schema.checkInRecord.timeIn}, 'YYYY-MM-DD')`;
  return db
    .select({ day, count: sql<number>`count(*)::int` })
    .from(schema.checkInRecord)
    .where(c.length ? and(...c) : undefined)
    .groupBy(day)
    .orderBy(day);
}
