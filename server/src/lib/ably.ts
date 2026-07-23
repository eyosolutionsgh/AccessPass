import * as Ably from 'ably';
import { env } from '../env.ts';
import { logger } from '../logger.ts';

/**
 * Ably REST backend for real-time "refetch" pokes on the serverless (Vercel) demo, where no
 * long-lived Socket.IO server can run. REST is connectionless — ideal for request-scoped functions.
 *
 * SECURITY: pokes are deliberately **contentless** (`{ at }` only). The web client uses realtime
 * purely as a "something changed, refetch" signal and re-reads the actual data over authenticated
 * tRPC — so no visitor/host PII ever traverses Ably, and channel scoping (below) is defence in depth.
 */
let rest: Ably.Rest | null = null;

export function isAblyEnabled(): boolean {
  return env.REALTIME_PROVIDER === 'ably' && !!env.ABLY_API_KEY;
}

function client(): Ably.Rest {
  if (!rest) rest = new Ably.Rest({ key: env.ABLY_API_KEY! });
  return rest;
}

/** Publish a contentless poke to an Ably channel. Fire-and-forget — a dropped poke just means the
 * client refetches on its next interval, so it must never fail the request that triggered it. */
export function publishAblyPoke(channel: string, at: string): void {
  if (!isAblyEnabled()) return;
  void client()
    .channels.get(channel)
    .publish('poke', { at })
    .catch((err) => logger.warn({ err, channel }, 'ably poke publish failed'));
}

/**
 * Mint a short-lived Ably token scoped to exactly the channels a session may subscribe to. The
 * capability is computed server-side from the better-auth session (see rest/internal.ts), so a
 * client can never subscribe to a channel its role doesn't grant — mirroring the Socket.IO
 * server-side room joins.
 */
export function createAblyTokenRequest(capability: Record<string, string[]>, clientId: string) {
  return client().auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000, // 1h — matched to a working session window
    capability: JSON.stringify(capability),
  });
}
