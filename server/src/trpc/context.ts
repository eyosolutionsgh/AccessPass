import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.ts';

/** Per-request tRPC context. Resolves the better-auth session from request headers/cookies. */
export async function createContext({ req, res }: CreateExpressContextOptions) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return {
    req,
    res,
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    session: result?.session ?? null,
    user: result?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
