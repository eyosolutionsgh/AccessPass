import { reportRangeSchema, visitorAnalyticsSchema, visitorSearchSchema } from '@vms/shared';
import {
  dailyVolume,
  statusBreakdown,
  visitorAnalytics,
  visitorLog,
  visitorSearch,
} from '../../services/reports.ts';
import { authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const reportsRouter = router({
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
