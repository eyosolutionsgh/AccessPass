import { reprintSchema } from '@vms/shared';
import { reprintBadge } from '../../services/credentials.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const badgesRouter = router({
  /** Reprint a visitor's badge with a logged reason (SRS FR-054). */
  reprint: authorized({ badge: ['reprint'] })
    .input(reprintSchema)
    .mutation(({ input, ctx }) => reprintBadge(input.visitId, input.reason, actorFrom(ctx.user))),
});
