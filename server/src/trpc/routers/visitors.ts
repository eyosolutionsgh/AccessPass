import { createVisitorSchema, visitorAnalyticsSchema, visitorSearchSchema } from '@vms/shared';
import { createDirectoryVisitor, getDirectoryVisitor } from '../../services/visitors.ts';
import { visitorSearch } from '../../services/reports.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

/**
 * Visitor directory — front-desk lookup and standalone capture, used when registering walk-ins
 * and when booking an appointment for someone already on file (SRS §9.1).
 */
export const visitorsRouter = router({
  /** Find an existing visitor by name/org/email/phone, ranked by visit frequency (staff). */
  lookup: authorized({ visitor: ['read'] })
    .input(visitorSearchSchema)
    .query(({ input }) => visitorSearch(input.q)),

  /** A single visitor's basic details — prefills a follow-up appointment (staff). */
  byId: authorized({ visitor: ['read'] })
    .input(visitorAnalyticsSchema)
    .query(({ input }) => getDirectoryVisitor(input.visitorId)),

  /** Capture a person into the directory without booking a visit — for later scheduling (staff). */
  create: authorized({ visitor: ['create'] })
    .input(createVisitorSchema)
    .mutation(({ input, ctx }) => createDirectoryVisitor(input, actorFrom(ctx.user))),
});
