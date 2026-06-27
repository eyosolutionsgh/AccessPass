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

/**
 * Visitor-insights search — find recurring visitors by name, organisation, email or phone,
 * ranked by how often they've visited. Powers the analyst drill-down picker.
 */
export async function visitorSearch(q: string, limit = 20) {
  const like = `%${q.toLowerCase()}%`;
  const occurredAt = sql<Date | null>`max(coalesce(${schema.visit.expectedArrival}, ${schema.visit.createdAt}))`;
  return db
    .select({
      visitorId: schema.visitor.id,
      fullName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      email: schema.visitor.email,
      phone: schema.visitor.phone,
      visitCount: sql<number>`count(${schema.visit.id})::int`,
      lastVisit: occurredAt,
    })
    .from(schema.visitor)
    .leftJoin(schema.visit, eq(schema.visit.visitorId, schema.visitor.id))
    .where(
      sql`(
        lower(${schema.visitor.fullName}) like ${like}
        or lower(coalesce(${schema.visitor.organization}, '')) like ${like}
        or lower(coalesce(${schema.visitor.email}, '')) like ${like}
        or coalesce(${schema.visitor.phone}, '') like ${`%${q}%`}
      )`,
    )
    .groupBy(schema.visitor.id)
    .orderBy(desc(sql`count(${schema.visit.id})`))
    .limit(limit);
}

const PURPOSE_UNSPECIFIED = 'Unspecified';

/** Sort a {key→count} map into a descending [{label,count}] list. */
function rank<T extends string>(counts: Map<T, number>, label: string) {
  return [...counts.entries()]
    .map(([k, count]) => ({ [label]: k, count }) as Record<string, T | number>)
    .sort((a, b) => (b.count as number) - (a.count as number));
}

/**
 * Per-visitor analytics — how often this visitor comes and the breakdown of WHY (purpose),
 * WHO they see (host) and the visit lifecycle. A visitor has at most a few dozen visits, so we
 * pull the rows once and aggregate in memory rather than firing several grouped queries.
 */
export async function visitorAnalytics(visitorId: string) {
  const [visitor] = await db
    .select({
      id: schema.visitor.id,
      fullName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      email: schema.visitor.email,
      phone: schema.visitor.phone,
    })
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visitorId));
  if (!visitor) return null;

  const occurredAt = sql<Date>`coalesce(${schema.visit.expectedArrival}, ${schema.visit.createdAt})`;
  const visits = await db
    .select({
      visitId: schema.visit.id,
      status: schema.visit.status,
      purpose: schema.visit.purpose,
      occurredAt,
      timeIn: schema.checkInRecord.timeIn,
      timeOut: schema.checkInRecord.timeOut,
      hostName: schema.host.name,
      facilityName: schema.facility.name,
    })
    .from(schema.visit)
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
    .leftJoin(schema.checkInRecord, eq(schema.checkInRecord.visitId, schema.visit.id))
    .where(eq(schema.visit.visitorId, visitorId))
    .orderBy(desc(occurredAt));

  const statuses = new Map<string, number>();
  const purposes = new Map<string, number>();
  const hosts = new Map<string, number>();
  const months = new Map<string, number>(); // 'YYYY-MM' → count
  let attended = 0; // visits actually checked in
  for (const v of visits) {
    statuses.set(v.status, (statuses.get(v.status) ?? 0) + 1);
    const purpose = v.purpose?.trim() || PURPOSE_UNSPECIFIED;
    purposes.set(purpose, (purposes.get(purpose) ?? 0) + 1);
    if (v.hostName) hosts.set(v.hostName, (hosts.get(v.hostName) ?? 0) + 1);
    const month = new Date(v.occurredAt).toISOString().slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    if (v.timeIn) attended += 1;
  }

  // Dense 12-month frequency timeline ending at the most recent visit's month (or now).
  const anchor = visits.length ? new Date(visits[0]!.occurredAt) : new Date();
  const timeline: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    timeline.push({ month: key, count: months.get(key) ?? 0 });
  }

  return {
    visitor,
    totalVisits: visits.length,
    attended,
    firstVisit: visits.length ? visits[visits.length - 1]!.occurredAt : null,
    lastVisit: visits.length ? visits[0]!.occurredAt : null,
    statusBreakdown: rank(statuses, 'status') as { status: string; count: number }[],
    purposeBreakdown: rank(purposes, 'purpose') as { purpose: string; count: number }[],
    hostBreakdown: (rank(hosts, 'hostName') as { hostName: string; count: number }[]).slice(0, 8),
    timeline,
    recentVisits: visits.slice(0, 25),
  };
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
