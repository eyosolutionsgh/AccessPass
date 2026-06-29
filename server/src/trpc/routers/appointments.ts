import { TRPCError } from '@trpc/server';
import {
  createVisitSchema,
  denyVisitSchema,
  idSchema,
  listVisitsSchema,
  updateVisitSchema,
  visitIdSchema,
} from '@vms/shared';
import * as appointments from '../../services/appointments.ts';
import {
  SchedulingConflictError,
  type ConflictDimension,
  type VisitConflict,
} from '../../services/conflicts.ts';
import { ForbiddenScopeError } from '../../services/scope.ts';
import { visitCheckpointTrail } from '../../services/checkpoints.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

const DIMENSION_LABEL: Record<ConflictDimension, string> = {
  host: 'the officer',
  office: 'the room',
  visitor: 'the visitor',
};

function fmtWindow(c: VisitConflict): string {
  if (!c.expectedArrival || !c.expectedDeparture) return '';
  const f = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');
  return ` (${f(c.expectedArrival)}–${f(c.expectedDeparture)} UTC)`;
}

/** Human-readable 409 message; the structured list rides on `cause` for richer client UIs. */
function conflictMessage(conflicts: VisitConflict[]): string {
  const parts = conflicts.slice(0, 3).map((c) => {
    const who = c.dimensions.map((d) => DIMENSION_LABEL[d]).join(' & ');
    const visitor = c.visitorName ? ` with ${c.visitorName}` : '';
    return `${who} already booked${fmtWindow(c)}${visitor}`;
  });
  const more = conflicts.length > 3 ? `; +${conflicts.length - 3} more` : '';
  return `Scheduling conflict — ${parts.join('; ')}${more}`;
}

/** Run an appointment mutation, translating clashes (409) and scope violations (403) for the UI. */
async function guardConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof SchedulingConflictError) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: conflictMessage(err.conflicts),
        cause: err,
      });
    }
    if (err instanceof ForbiddenScopeError) {
      throw new TRPCError({ code: 'FORBIDDEN', message: err.message, cause: err });
    }
    throw err;
  }
}

export const appointmentsRouter = router({
  create: authorized({ appointment: ['create'] })
    .input(createVisitSchema)
    .mutation(({ input, ctx }) =>
      guardConflict(() => appointments.createVisit(input, actorFrom(ctx.user))),
    ),

  list: authorized({ appointment: ['read'] })
    .input(listVisitsSchema)
    .query(({ input }) => appointments.listVisits(input)),

  get: authorized({ appointment: ['read'] })
    .input(visitIdSchema)
    .query(({ input }) => appointments.getVisit(input.visitId)),

  /** The visitor's checkpoint trail (entry → internal passages → exit) with checkpoint names. */
  trail: authorized({ appointment: ['read'] })
    .input(visitIdSchema)
    .query(({ input }) => visitCheckpointTrail(input.visitId)),

  /** Identity images (selfie / ID) captured at pre-registration — metadata only. */
  documents: authorized({ appointment: ['read'] })
    .input(visitIdSchema)
    .query(({ input }) => appointments.listVisitDocuments(input.visitId)),

  /** A single identity image's bytes (base64), proxied from object storage. */
  document: authorized({ appointment: ['read'] })
    .input(idSchema)
    .query(({ input }) => appointments.getVisitDocument(input.id)),

  update: authorized({ appointment: ['update'] })
    .input(updateVisitSchema)
    .mutation(({ input, ctx }) =>
      guardConflict(() => appointments.updateVisit(input, actorFrom(ctx.user))),
    ),

  cancel: authorized({ appointment: ['cancel'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) => appointments.cancelVisit(input.visitId, actorFrom(ctx.user))),

  approve: authorized({ appointment: ['approve'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) =>
      guardConflict(() => appointments.approveVisit(input.visitId, actorFrom(ctx.user))),
    ),

  deny: authorized({ appointment: ['deny'] })
    .input(denyVisitSchema)
    .mutation(({ input, ctx }) =>
      appointments.denyVisit(input.visitId, input.reason, actorFrom(ctx.user)),
    ),
});
