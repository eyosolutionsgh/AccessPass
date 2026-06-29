import {
  insightsLogSchema,
  reportRangeSchema,
  visitorAnalyticsSchema,
  visitorSearchSchema,
} from '@vms/shared';
import {
  dailyVolume,
  insightsLog,
  reportFacilities,
  statusBreakdown,
  visitorAnalytics,
  visitorInsights,
  visitorLog,
  visitorSearch,
} from '../../services/reports.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const reportsRouter = router({
  /**
   * Operational visitor-insights analytics (walk-ins vs scheduled, daily trend, peak hours…).
   * `report:['insights']` is granted to front-desk + security roles too, not just oversight.
   * Data is scoped server-side to the caller's facilities (front-line) or org-wide (management).
   */
  insights: authorized({ report: ['insights'] })
    .input(reportRangeSchema)
    .query(({ input, ctx }) => visitorInsights(input, actorFrom(ctx.user))),

  /** Filterable, paginated visitor-log list behind the insights page (same facility scope). */
  insightsLog: authorized({ report: ['insights'] })
    .input(insightsLogSchema)
    .query(({ input, ctx }) => insightsLog(input, actorFrom(ctx.user))),

  /** Facilities the caller may filter by on the insights page (their own, or all for management). */
  insightsFacilities: authorized({ report: ['insights'] }).query(({ ctx }) =>
    reportFacilities(actorFrom(ctx.user)),
  ),

  visitorLog: authorized({ report: ['read'] })
    .input(reportRangeSchema)
    .query(({ input }) => visitorLog(input, 500)),

  statusBreakdown: authorized({ report: ['read'] })
    .input(reportRangeSchema)
    .query(({ input }) => statusBreakdown(input)),

  dailyVolume: authorized({ report: ['read'] })
    .input(reportRangeSchema)
    .query(({ input }) => dailyVolume(input)),

  // ── Visitor insights (per-visitor frequency + purpose drill-down) ──────────
  visitorSearch: authorized({ report: ['read'] })
    .input(visitorSearchSchema)
    .query(({ input }) => visitorSearch(input.q)),

  visitorAnalytics: authorized({ report: ['read'] })
    .input(visitorAnalyticsSchema)
    .query(({ input }) => visitorAnalytics(input.visitorId)),
});
