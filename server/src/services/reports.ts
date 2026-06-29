import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import {
  anyRoleHasPermission,
  schema,
  type InsightsLogInput,
  type ReportRangeInput,
} from '@vms/shared';
import { db } from '../db.ts';

type Actor = { id: string; role?: string | null };

/**
 * Which facilities a user may report on. `null` = unrestricted (management — anyone with full
 * `report:read`). Otherwise the user is a front-line operator scoped to the facilities of the
 * point(s) they're assigned to plus their own host facility (fail-closed: empty = sees nothing).
 */
export async function reportScope(actor: Actor): Promise<string[] | null> {
  if (anyRoleHasPermission(actor.role ?? null, { report: ['read'] })) return null;
  const pts = await db
    .select({ facilityId: schema.point.facilityId })
    .from(schema.pointAssignment)
    .innerJoin(schema.point, eq(schema.point.id, schema.pointAssignment.pointId))
    .where(eq(schema.pointAssignment.userId, actor.id));
  const [host] = await db
    .select({ facilityId: schema.host.facilityId })
    .from(schema.host)
    .where(eq(schema.host.userId, actor.id));
  const ids = new Set<string>();
  for (const p of pts) if (p.facilityId) ids.add(p.facilityId);
  if (host?.facilityId) ids.add(host.facilityId);
  return [...ids];
}

/**
 * The effective facility id-set for a query, combining the user's scope with an optional explicit
 * filter. `null` = no facility restriction (management, all facilities). `[]` = show nothing
 * (a scoped user with no assigned facility, or filtering to one outside their scope).
 */
function effectiveFacilities(scope: string[] | null, requested?: string): string[] | null {
  if (scope === null) return requested ? [requested] : null;
  if (scope.length === 0) return [];
  if (requested) return scope.includes(requested) ? [requested] : [];
  return scope;
}

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

/**
 * Operational visitor insights for the front-desk / security analytics page — totals, the
 * walk-in vs scheduled-appointment split, a daily trend, status mix, peak arrival hours and the
 * busiest departments, all for a date range. One call powers the whole dashboard. Visits are
 * dated by `coalesce(expectedArrival, createdAt)` so walk-ins (no scheduled time) count on the
 * day they happened. Scoped to the actor's facilities (front-line) or org-wide (management).
 */
export async function visitorInsights(input: ReportRangeInput, actor: Actor) {
  const facilities = effectiveFacilities(await reportScope(actor), input.facilityId);
  if (facilities && facilities.length === 0) return emptyInsights();
  const facilityCond = facilities ? inArray(schema.visit.facilityId, facilities) : undefined;

  const occurredAt = sql<Date>`coalesce(${schema.visit.expectedArrival}, ${schema.visit.createdAt})`;
  const where = [];
  if (facilityCond) where.push(facilityCond);
  if (input.from) where.push(gte(occurredAt, input.from));
  if (input.to) where.push(lte(occurredAt, input.to));
  const whereClause = where.length ? and(...where) : undefined;

  // Origin × status in one pass → totals, origin split and status mix.
  const originStatus = await db
    .select({
      origin: schema.visit.origin,
      status: schema.visit.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.visit)
    .where(whereClause)
    .groupBy(schema.visit.origin, schema.visit.status);

  // Daily trend, split by origin (walk-in vs appointment).
  const dayExpr = sql<string>`to_char(${occurredAt}, 'YYYY-MM-DD')`;
  const dayRows = await db
    .select({ day: dayExpr, origin: schema.visit.origin, count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .where(whereClause)
    .groupBy(dayExpr, schema.visit.origin)
    .orderBy(dayExpr);

  // Peak arrival hours — actual check-ins (footfall) in the range.
  const hourExpr = sql<number>`extract(hour from ${schema.checkInRecord.timeIn})::int`;
  const hourWhere = [];
  if (facilityCond) hourWhere.push(facilityCond);
  if (input.from) hourWhere.push(gte(schema.checkInRecord.timeIn, input.from));
  if (input.to) hourWhere.push(lte(schema.checkInRecord.timeIn, input.to));
  const hourRows = await db
    .select({ hour: hourExpr, count: sql<number>`count(*)::int` })
    .from(schema.checkInRecord)
    .innerJoin(schema.visit, eq(schema.visit.id, schema.checkInRecord.visitId))
    .where(hourWhere.length ? and(...hourWhere) : undefined)
    .groupBy(hourExpr);

  // Busiest departments — the visit's own department (walk-in) or its host's (appointment).
  const deptId = sql`coalesce(${schema.visit.departmentId}, ${schema.host.departmentId})`;
  const deptRows = await db
    .select({ name: schema.department.name, count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.department, eq(schema.department.id, deptId))
    .where(whereClause)
    .groupBy(schema.department.name)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  // Most-visited officers (scheduled visits — walk-ins to a department have no host).
  const hostRows = await db
    .select({ name: schema.host.name, count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .innerJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .where(whereClause)
    .groupBy(schema.host.name)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  // Average on-site duration of completed visits (minutes).
  const durWhere = [isNotNull(schema.checkInRecord.timeOut)];
  if (facilityCond) durWhere.push(facilityCond);
  if (input.from) durWhere.push(gte(schema.checkInRecord.timeIn, input.from));
  if (input.to) durWhere.push(lte(schema.checkInRecord.timeIn, input.to));
  const [dur] = await db
    .select({
      avgSec: sql<
        number | null
      >`avg(extract(epoch from (${schema.checkInRecord.timeOut} - ${schema.checkInRecord.timeIn})))::float`,
    })
    .from(schema.checkInRecord)
    .innerJoin(schema.visit, eq(schema.visit.id, schema.checkInRecord.visitId))
    .where(and(...durWhere));

  let total = 0;
  let walkIns = 0;
  let appointments = 0;
  const statusMap = new Map<string, number>();
  for (const r of originStatus) {
    total += r.count;
    if (r.origin === 'walk_in') walkIns += r.count;
    else appointments += r.count;
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + r.count);
  }
  const s = (k: string) => statusMap.get(k) ?? 0;
  // Anyone who actually arrived (on-site now or already left) — real footfall.
  const attended = s('checked_in') + s('checked_out');
  const avgDurationMins = dur?.avgSec ? Math.round(dur.avgSec / 60) : 0;

  const dayMap = new Map<string, { walkIns: number; appointments: number }>();
  for (const r of dayRows) {
    const e = dayMap.get(r.day) ?? { walkIns: 0, appointments: 0 };
    if (r.origin === 'walk_in') e.walkIns += r.count;
    else e.appointments += r.count;
    dayMap.set(r.day, e);
  }
  const byDay = [...dayMap.entries()]
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const hourMap = new Map<number, number>();
  for (const r of hourRows) hourMap.set(r.hour, r.count);
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourMap.get(hour) ?? 0 }));

  return {
    totals: {
      total,
      walkIns,
      appointments,
      attended,
      noShow: s('no_show'),
      onSite: s('checked_in'),
      avgDurationMins,
    },
    byDay,
    byOrigin: [
      { origin: 'appointment' as const, count: appointments },
      { origin: 'walk_in' as const, count: walkIns },
    ],
    byHour,
    topDepartments: deptRows
      .filter((r): r is { name: string; count: number } => Boolean(r.name))
      .map((r) => ({ name: r.name, count: r.count })),
    topHosts: hostRows
      .filter((r): r is { name: string; count: number } => Boolean(r.name))
      .map((r) => ({ name: r.name, count: r.count })),
  };
}

/** Zero-valued insights payload — returned when a scoped user has no facility to report on. */
function emptyInsights() {
  return {
    totals: {
      total: 0,
      walkIns: 0,
      appointments: 0,
      attended: 0,
      noShow: 0,
      onSite: 0,
      avgDurationMins: 0,
    },
    byDay: [] as { day: string; walkIns: number; appointments: number }[],
    byOrigin: [
      { origin: 'appointment' as const, count: 0 },
      { origin: 'walk_in' as const, count: 0 },
    ],
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    topDepartments: [] as { name: string; count: number }[],
    topHosts: [] as { name: string; count: number }[],
  };
}

/** Shared scope + filter conditions for the visitor-log list/export. `null` = show nothing. */
async function logConditions(input: InsightsLogInput, actor: Actor) {
  const facilities = effectiveFacilities(await reportScope(actor), input.facilityId);
  if (facilities && facilities.length === 0) return null;
  const occurredAt = sql<Date>`coalesce(${schema.visit.expectedArrival}, ${schema.visit.createdAt})`;
  const conds = [];
  if (facilities) conds.push(inArray(schema.visit.facilityId, facilities));
  if (input.from) conds.push(gte(occurredAt, input.from));
  if (input.to) conds.push(lte(occurredAt, input.to));
  if (input.status) conds.push(eq(schema.visit.status, input.status));
  if (input.origin) conds.push(eq(schema.visit.origin, input.origin));
  if (input.search) {
    const q = `%${input.search}%`;
    conds.push(
      or(
        ilike(schema.visitor.fullName, q),
        ilike(schema.visitor.organization, q),
        ilike(schema.host.name, q),
      ),
    );
  }
  return { where: conds.length ? and(...conds) : undefined, occurredAt };
}

/** The visitor-log row select (joins) shared by the paginated list and the export. */
function logRowsQuery(where: ReturnType<typeof and>, occurredAt: ReturnType<typeof sql>) {
  return db
    .select({
      visitId: schema.visit.id,
      visitorName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      hostName: schema.host.name,
      departmentName: schema.department.name,
      facilityName: schema.facility.name,
      origin: schema.visit.origin,
      status: schema.visit.status,
      timeIn: schema.checkInRecord.timeIn,
      timeOut: schema.checkInRecord.timeOut,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(
      schema.department,
      eq(
        schema.department.id,
        sql`coalesce(${schema.visit.departmentId}, ${schema.host.departmentId})`,
      ),
    )
    .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
    .leftJoin(schema.checkInRecord, eq(schema.checkInRecord.visitId, schema.visit.id))
    .where(where)
    .orderBy(desc(occurredAt));
}

/**
 * Filterable, paginated visitor-log report (the dedicated Visitor log page). Scoped to the actor's
 * facilities (front-line) or org-wide (management); filters by status, origin and free text.
 */
export async function insightsLog(input: InsightsLogInput, actor: Actor) {
  const f = await logConditions(input, actor);
  if (!f) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };
  const items = await logRowsQuery(f.where, f.occurredAt)
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .where(f.where);
  return { items, total: count, page: input.page, pageSize: input.pageSize };
}

/** Full filtered + scoped visitor-log rows for CSV/XLSX export (capped). */
export async function insightsLogExport(input: InsightsLogInput, actor: Actor, limit = 5000) {
  const f = await logConditions(input, actor);
  if (!f) return [];
  return logRowsQuery(f.where, f.occurredAt).limit(limit);
}

/** The facilities a user may pick in the insights filter — scoped to their own, or all (management). */
export async function reportFacilities(actor: Actor) {
  const scope = await reportScope(actor);
  if (scope && scope.length === 0) return [];
  const conds = [eq(schema.facility.isActive, true)];
  if (scope) conds.push(inArray(schema.facility.id, scope));
  return db
    .select({ id: schema.facility.id, name: schema.facility.name })
    .from(schema.facility)
    .where(and(...conds))
    .orderBy(schema.facility.name);
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
