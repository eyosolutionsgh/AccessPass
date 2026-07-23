import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import express, { Router } from 'express';
import { anyRoleHasPermission, schema } from '@vms/shared';
import { auth } from '../auth.ts';
import { db } from '../db.ts';
import { createAblyTokenRequest, isAblyEnabled } from '../lib/ably.ts';
import { asyncHandler } from '../lib/http-errors.ts';
import { verifyQstashSignature } from '../lib/qstash.ts';
import { logger } from '../logger.ts';
import { runExpirySweep } from '../services/credentials.ts';
import { runRetentionSweep } from '../services/retention.ts';

/**
 * Internal routes for the serverless (Vercel) demo. Mounted at `/api` (before `express.json()` so the
 * QStash callbacks can read their raw body for signature verification). Inert on-prem: the QStash
 * routes 401 without signing keys and the realtime token 503s unless Ably is configured.
 */
export const internalRouter = Router();

/**
 * QStash cron callbacks — run the maintenance sweeps that the in-process BullMQ worker runs on-prem.
 * `express.text` captures the raw body (empty for these no-payload schedules) that QStash signed.
 */
internalRouter.post(
  '/internal/qstash/:job',
  express.text({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    const signature = req.header('upstash-signature');
    const body = typeof req.body === 'string' ? req.body : '';
    if (!(await verifyQstashSignature(signature, body))) {
      logger.warn({ job: req.params.job }, 'rejected qstash callback: bad signature');
      res.status(401).json({ error: 'invalid signature' });
      return;
    }
    if (req.params.job === 'expiry-sweep') {
      res.json({ ok: true, ...(await runExpirySweep()) });
      return;
    }
    if (req.params.job === 'retention-sweep') {
      res.json({ ok: true, ...(await runRetentionSweep()) });
      return;
    }
    res.status(404).json({ error: 'unknown job' });
  }),
);

/**
 * Ably token endpoint — returns a bare TokenRequest (what the client's `authUrl` expects). Channel
 * capabilities are derived server-side from the better-auth session's role/host, mirroring the
 * Socket.IO server-side room joins in index.ts, so a client can only subscribe to channels its role
 * grants. (Pokes are contentless anyway — this is defence in depth.)
 */
internalRouter.get(
  '/realtime/token',
  asyncHandler(async (req, res) => {
    if (!isAblyEnabled()) {
      res.status(503).json({ error: 'realtime disabled' });
      return;
    }
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const role = (session.user as { role?: string | null }).role ?? null;
    const capability: Record<string, string[]> = {};
    if (
      (['reception', 'security', 'host'] as const).some((a) =>
        anyRoleHasPermission(role, { dashboard: [a] }),
      )
    ) {
      capability.dashboard = ['subscribe'];
    }
    if (anyRoleHasPermission(role, { dashboard: ['security'] })) {
      capability.security = ['subscribe'];
    }
    const [host] = await db
      .select({ id: schema.host.id })
      .from(schema.host)
      .where(eq(schema.host.userId, session.user.id));
    if (host) capability[`host:${host.id}`] = ['subscribe'];
    // Ably requires at least one resource; a private per-user channel is a harmless placeholder for a
    // session with no dashboard/host channels (it simply never receives pokes).
    if (Object.keys(capability).length === 0) capability[`user:${session.user.id}`] = ['subscribe'];

    res.json(await createAblyTokenRequest(capability, session.user.id));
  }),
);
