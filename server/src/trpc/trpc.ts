import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.ts';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/** Requires an authenticated staff user (SRS FR-001). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});
