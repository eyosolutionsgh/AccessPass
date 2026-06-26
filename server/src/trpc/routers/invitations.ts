import { invitationIdSchema, visitIdSchema } from '@vms/shared';
import { issueInvitation, resendInvitation, revokeInvitation } from '../../services/invitations.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const invitationsRouter = router({
  send: authorized({ invitation: ['create'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) => issueInvitation(input.visitId, actorFrom(ctx.user))),

  resend: authorized({ invitation: ['resend'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) => resendInvitation(input.visitId, actorFrom(ctx.user))),

  regenerate: authorized({ invitation: ['regenerate'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) => resendInvitation(input.visitId, actorFrom(ctx.user))),

  revoke: authorized({ invitation: ['revoke'] })
    .input(invitationIdSchema)
    .mutation(({ input, ctx }) => revokeInvitation(input.invitationId, actorFrom(ctx.user))),
});
