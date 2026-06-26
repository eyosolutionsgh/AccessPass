import { router } from '../trpc.ts';
import { adminRouter } from './admin.ts';
import { aiRouter } from './ai.ts';
import { appointmentsRouter } from './appointments.ts';
import { auditRouter } from './audit.ts';
import { badgesRouter } from './badges.ts';
import { checkinRouter } from './checkin.ts';
import { dashboardRouter } from './dashboard.ts';
import { healthRouter } from './health.ts';
import { incidentsRouter } from './incidents.ts';
import { invitationsRouter } from './invitations.ts';
import { lookupsRouter } from './lookups.ts';
import { preregRouter } from './prereg.ts';
import { reportsRouter } from './reports.ts';
import { watchlistRouter } from './watchlist.ts';

/**
 * Root tRPC router. Feature routers (admin, reporting) are merged here as each build phase lands.
 */
export const appRouter = router({
  health: healthRouter,
  appointments: appointmentsRouter,
  invitations: invitationsRouter,
  lookups: lookupsRouter,
  checkin: checkinRouter,
  prereg: preregRouter,
  dashboard: dashboardRouter,
  badges: badgesRouter,
  watchlist: watchlistRouter,
  incidents: incidentsRouter,
  audit: auditRouter,
  admin: adminRouter,
  reports: reportsRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
