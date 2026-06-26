import { reportRangeSchema } from '@vms/shared';
import { dailyVolume, statusBreakdown, visitorLog } from '../../services/reports.ts';
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
});
