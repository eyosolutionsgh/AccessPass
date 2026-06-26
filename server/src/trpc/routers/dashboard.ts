import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '@vms/shared';
import { db } from '../../db.ts';
import { musterList, securitySummary } from '../../services/security.ts';
import { authorized, authorizedAny } from '../permission.ts';
import { router } from '../trpc.ts';

const canView = () => authorizedAny({ dashboard: ['reception'] }, { dashboard: ['security'] });
const facilityFilter = z.object({ facilityId: z.uuid().optional() });

export const dashboardRouter = router({
  /** Visitors currently on-site — emergency/occupancy view (SRS §5.4, FR-091). */
  onSite: canView()
    .input(facilityFilter)
    .query(({ input }) => {
      const conditions = [eq(schema.visit.status, 'checked_in')];
      if (input.facilityId) conditions.push(eq(schema.visit.facilityId, input.facilityId));
      return db
        .select({
          visitId: schema.visit.id,
          visitorName: schema.visitor.fullName,
          organization: schema.visitor.organization,
          hostName: schema.host.name,
          facilityName: schema.facility.name,
          timeIn: schema.checkInRecord.timeIn,
          badgeNumber: schema.credential.badgeNumber,
        })
        .from(schema.visit)
        .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
        .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
        .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
        .leftJoin(
          schema.checkInRecord,
          and(
            eq(schema.checkInRecord.visitId, schema.visit.id),
            isNull(schema.checkInRecord.timeOut),
          ),
        )
        .leftJoin(
          schema.credential,
          and(
            eq(schema.credential.visitId, schema.visit.id),
            eq(schema.credential.status, 'active'),
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.checkInRecord.timeIn));
    }),

  /** Visit counts by status (reception overview, SRS FR-090). */
  summary: canView()
    .input(facilityFilter)
    .query(async ({ input }) => {
      const rows = await db
        .select({ status: schema.visit.status, count: sql<number>`count(*)::int` })
        .from(schema.visit)
        .where(input.facilityId ? eq(schema.visit.facilityId, input.facilityId) : undefined)
        .groupBy(schema.visit.status);
      return Object.fromEntries(rows.map((r) => [r.status, r.count]));
    }),

  /** Security KPIs: on-site, open incidents, overstays, denials (SRS FR-091). */
  security: authorized({ dashboard: ['security'] }).query(() => securitySummary()),

  /** Emergency mustering list with contact details (SRS §5.4). */
  muster: authorized({ dashboard: ['security'] })
    .input(facilityFilter)
    .query(({ input }) => musterList(input.facilityId)),
});
