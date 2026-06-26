import { incidentCreateSchema, incidentListSchema, incidentResolveSchema } from '@vms/shared';
import { createIncident, listIncidents, resolveIncident } from '../../services/security.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const incidentsRouter = router({
  list: authorized({ incident: ['read'] })
    .input(incidentListSchema)
    .query(({ input }) => listIncidents(input)),

  create: authorized({ incident: ['create'] })
    .input(incidentCreateSchema)
    .mutation(({ input, ctx }) => createIncident(input, actorFrom(ctx.user))),

  resolve: authorized({ incident: ['resolve'] })
    .input(incidentResolveSchema)
    .mutation(({ input, ctx }) =>
      resolveIncident(input.incidentId, input.resolution, actorFrom(ctx.user)),
    ),
});
