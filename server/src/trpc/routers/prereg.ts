import { TRPCError } from '@trpc/server';
import { preRegSubmitSchema, tokenSchema } from '@vms/shared';
import { getPreReg, submitPreReg } from '../../services/prereg.ts';
import { rateLimited } from '../permission.ts';
import { router } from '../trpc.ts';

export const preregRouter = router({
  /** Resolve pre-registration context from the invitation token (public). */
  get: rateLimited(30, 60)
    .input(tokenSchema)
    .query(async ({ input }) => {
      const ctx = await getPreReg(input.token);
      if (!ctx) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'This pre-registration link is invalid or has expired.',
        });
      }
      return ctx;
    }),

  /** Submit pre-registration details and acknowledgements (public). */
  submit: rateLimited(20, 60)
    .input(preRegSubmitSchema)
    .mutation(({ input }) => submitPreReg(input)),
});
