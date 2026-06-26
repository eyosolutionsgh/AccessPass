import type { IncomingHttpHeaders } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.ts';

export type SocketUser = { id: string; role: string | null };

/**
 * Resolve the better-auth session from a Socket.IO handshake's headers (the session cookie rides
 * the upgrade request). `createContext` takes an Express `req`, so it can't be reused as-is — this
 * is the socket-side equivalent. Returns null when there is no valid session.
 */
export async function getSocketUser(headers: IncomingHttpHeaders): Promise<SocketUser | null> {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!result?.user) return null;
  return { id: result.user.id, role: (result.user as { role?: string | null }).role ?? null };
}
