import { eq } from 'drizzle-orm';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { schema } from '@vms/shared';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { recordAudit } from '../lib/audit.ts';
import { asyncHandler } from '../lib/http-errors.ts';
import { getLogo } from '../services/admin.ts';
import { openapiDocument } from './openapi.ts';

/**
 * REST/OpenAPI gateway for EXTERNAL integrators (access-control, directory/HR, SIEM, BI) —
 * SRS §10.4. The internal web/kiosk app uses tRPC. Data endpoints are authenticated with a
 * shared API key (X-API-Key); the spec and health probe are open.
 */
export const restRouter = Router();

restRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', api: 'v1' });
});

restRouter.get('/openapi.json', (_req, res) => {
  res.json(openapiDocument());
});

/**
 * Public institution logo — the uploaded emblem shown on the sign-in, sidebar and kiosk screens.
 * Open (no API key): it's branding rendered before any visitor signs in. The URL carries a `?v=`
 * version stamp from `publicConfig`, so the bytes are immutable-cacheable and a new upload busts it.
 * 404 when none is set; the web app then falls back to the bundled default asset.
 */
restRouter.get(
  '/branding/logo',
  asyncHandler(async (_req, res) => {
    const logo = await getLogo();
    if (!logo) {
      res.status(404).json({ error: 'no logo set' });
      return;
    }
    res.setHeader('Content-Type', logo.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Allow the <img> to load when the API is on a different subdomain than the web app, and
    // lock the response down (an SVG opened directly can't run scripts / fetch anything).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(logo.data, 'base64'));
  }),
);

// API-key gate for the data endpoints.
function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.INTEGRATION_API_KEY) {
    res.status(503).json({ error: 'integration gateway disabled' });
    return;
  }
  if (req.header('x-api-key') !== env.INTEGRATION_API_KEY) {
    res.status(401).json({ error: 'invalid api key' });
    return;
  }
  next();
}
restRouter.use(apiKeyAuth);

/** Current on-site visitors for external monitoring (SRS §10.4). */
restRouter.get(
  '/visitors/on-site',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        visitId: schema.visit.id,
        visitor: schema.visitor.fullName,
        organization: schema.visitor.organization,
        host: schema.host.name,
        facility: schema.facility.name,
        badgeNumber: schema.credential.badgeNumber,
      })
      .from(schema.visit)
      .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
      .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
      .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
      .leftJoin(schema.credential, eq(schema.credential.visitId, schema.visit.id))
      .where(eq(schema.visit.status, 'checked_in'));
    res.json({ count: rows.length, visitors: rows });
  }),
);

const accessEventSchema = z.object({
  badgeNumber: z.string().max(60).optional(),
  visitId: z.uuid().optional(),
  event: z.string().max(120),
  at: z.string().optional(),
});

/** Receive door-access events from the access-control system (SRS §10.4). */
restRouter.post(
  '/access-events',
  asyncHandler(async (req, res) => {
    const parsed = accessEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload' });
      return;
    }
    await recordAudit(db, {
      action: 'access.event',
      objectType: 'credential',
      sourceIp: req.ip,
      metadata: parsed.data,
    });
    res.json({ ok: true });
  }),
);
